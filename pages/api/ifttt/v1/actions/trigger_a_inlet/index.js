const { connectToDatabase } = require("../../../../../../lib/mongodb");
import { fetchUser } from "../../../../../../lib/googleadapter";
const { NodeVM, VM } = require("vm2");

const MAX_SCHEDULED = 25;

const ObjectId = require("mongodb").ObjectId;
export default async function handler(req, res) {
  if (req.method !== "POST") return;

  const { db } = await connectToDatabase();

  let email;
  let actionFields;
  let data;
  if ("authorization" in req.headers) {
    const responseJson = await fetchUser(req);
    if (typeof responseJson.error !== "undefined") {
      return res.status(401).json({
        success: false,
        errors: [{ message: "Invalid Authentication Token" }],
      });
    }
    if (typeof req.body.actionFields === "undefined") {
      console.error(
        "1) Missing req.body.actionFields. req.body is: ",
        req.body
      );
      return res.status(400).json({
        success: false,
        errors: [{ message: "Missing ActionFields Key" }],
      });
    }

    email = responseJson.email;
    actionFields = req.body.actionFields;

    data = actionFields.data || "";
  } else {
    email = req.query.email;

    const body = JSON.parse(req.body);
    actionFields = body.actionFields;
    data = actionFields.data || "";
  }

  let inlet = await db
    .collection("inlets")
    .find({
      $and: [{ email: email }, { name: actionFields.inlet }],
    })
    .toArray();

  let inlets = await db.collection("inlets").find({ email }).toArray();

  if (inlet.length != 1) {
    return res.status(400).json({
      success: false,
      errors: [{ message: "Missing ActionFields Inlet" }],
    });
  }

  let outlets = await db
    .collection("outlets")
    .find({
      $and: [{ email: email }],
    })
    .toArray();

  let variables = await db
    .collection("variables")
    .find({
      $and: [{ email: email }],
    })
    .toArray();

  let scheduledCount = await db.collection("sched").countDocuments({ email });

  // variables stored as strings... so lets fix that here.
  variables.forEach((v) => {
    if (v.type === "boolean") {
      v.value = v.value === "true";
    } else if (v.type === "int") {
      v.value = parseInt(v.value);
    } else if (v.type === "double") {
      v.value = parseFloat(v.value);
    } else if (v.type === "JSON") {
      console.warn("JSON: ", v.value);
      try {
        v.value = JSON.parse(v.value);
      } catch (e) {
        v.value = "PARSE_ERROR";
      }
    }
  });

  /* ///////////////////////
  Define our API Functions:
    loadState
    saveState
    callOutlet
    ithemLog
    scheduleOutlet
    Now, Hours, Minutes, Days
  */ ////////////////////////
  const loadState = (value) => {
    const found = variables.find((elm) => elm.name == value);
    if (typeof found === "undefined") {
      throw `Error: loadState("${value}": state "${value}" does not exist.)`;
    }
    return found.value;
  };

  const saveState = (name, val) => {
    const found = variables.find((elm) => elm.name == name);
    // console.log(found);
    // console.error(name, ":", found);
    if (typeof found === "undefined") {
      throw Error(`Error: saveState(): state "${name}" does not exist.)`);
    }

    const type = found.type;
    if (type === "boolean" && !(true === val || false === val)) {
      throw Error(
        `saveState("${name}", ${val}) failed: ${val} is not a boolean.`
      );
    } else if (["int", "double"].includes(type) && typeof val !== "number") {
      throw Error(
        `saveState("${name}", ${val}) failed: ${val} is not a number.`
      );
    } else if (type === "int") {
      val = parseInt(val);
    } else if (type === "JSON") {
      val = JSON.stringify(val);
    }

    // Would be good to actually await here, but it makes throwing errors problematic, so....
    // Let's just update the value and hope the fetch() works!
    found.value = val;
    fetch(
      `https://ithem.cs.vt.edu/api/var/update?id=${found._id}&value=${val}`,
      {
        method: "POST",
      }
    );
  };

  let eventID = -1;
  let fStatus = 0;
  const callOutlet = (name, data) => {
    const found = outlets.find((elm) => elm.name == name);
    fStatus = found;

    // if there're two outlets/variables that have the same name, only one of them will be called.
    if (typeof found === "undefined") {
      throw `callOutlet() error: outlet "${name}" does not exist`;
    } else {
      const msg =
        found.status === "true"
          ? "Outlet Ran Manually by callOutlet(). [Passing on to IFTTT]"
          : "Disabled Outlet Ran Manually by callOutlet().";

      const type = "outlet";
      fetch(
        `https://ithem.cs.vt.edu/api/events/create?email=${email}&name=${name}&note=${msg}&type=${type}&data=${data}&status=${found.status}`,
        {
          method: "POST",
        }
      ).then((res) => {
        eventID = res._id;
      });
    }
  };

  let _log = [];
  const ithemLog = function (...args) {
    _log.push(
      args
        .map((s) => (typeof s === "object" ? JSON.stringify(s) : "" + s))
        .join(" ")
    );
  };
  const log = ithemLog;

  // TODO: if we have to many things scheduled, this should throw an error.
  // We can fetch the currently scheduled things above.
  const scheduleOutlet = (outlet, time, data) => {
    if (typeof time === "object") {
      time = time.getTime ? time.getTime() : 0;
    }
    console.log("Scheduling: ", outlet, time, data);
    if (!outlets.find((e) => e.name === outlet)) {
      throw `scheduleOutlet() error: outlet "${outlet}" does not exist`;
    } else if (scheduledCount >= MAX_SCHEDULED) {
      throw `scheduleOutlet() error: cannot schedule more than ${MAX_SCHEDULED} outstanding inlet/outlet calls.`;
    }
    scheduledCount++;

    // Ideally we'd use await, but... if I recall, we cannot :)
    db.collection("sched")
      .insertOne({
        email,
        outletName: outlet,
        outletArg: data,
        schedTime: time,
        executed: false,
        createdAt: new Date(),
      })
      .then((res) => {
        console.log("DID IT", res);
      });
  };

  const triggerInlet = (inletName, data) => {
    // This won't actually run it for now lol
    if (!inlets.find((x) => x.name === inletName)) {
      throw `triggerInlet() error: inlet "${inletName}" does not exist`;
    }
    const msg = `Inlet triggered from code in inlet ${inlet.name}`;
    fetch(
      `https://ithem.cs.vt.edu/api/events/create?email=${email}&name=${inletName}&note=${msg}&type=inlet`,
      { method: "POST" }
    );
  };

  const scheduleInlet = (inlet, time, data) => {
    if (typeof time === "object") {
      time = time.getTime ? time.getTime() : 0;
    }
    if (!inlets.find((e) => e.name === inlet)) {
      throw `scheduleInlet() error: inlet "${inlet}" does not exist`;
    } else if (scheduledCount >= MAX_SCHEDULED) {
      throw `scheduleInlet() error: cannot schedule more than ${MAX_SCHEDULED} outstanding inlet/outlet calls.`;
    }
    scheduledCount++;

    // Ideally we'd use await, but... if I recall, we cannot :)
    db.collection("sched")
      .insertOne({
        email,
        inletName: inlet,
        inletArg: data || "",
        schedTime: time,
        executed: false,
        createdAt: new Date(),
      })
      .then((res) => {
        console.log("DID IT", res);
      });
  };

  const Now = () => new Date().getTime();
  const Seconds = (x) => x * 1000;
  const Minutes = (x) => Seconds(x) * 60;
  const Hours = (x) => Minutes(x) * 60;
  const Days = (x) => Hours(x) * 24;

  const handleInletLog = (inlet) => {
    const msg = "Inlet Ran By IFTTT";
    const type = "inlet";
    fetch(
      `https://ithem.cs.vt.edu/api/events/create?email=${email}&name=${inlet.name}&note=${msg}&type=${type}`,
      {
        method: "POST",
      }
    );
  };
  if (!req.query.editor) handleInletLog(inlet[0]);

  // This is necessary to catch async errors that aren't caught by the try/catch surrounding vm.run().
  // Unfortunately, these errors silently fails for the user, but if we don't have this, we can bring down the server :)
  process.on("uncaughtException", (err) => {
    console.error("Asynchronous error caught.", err);
  });

  const vm = new VM({
    allowAsync: true,
    sandbox: {
      loadState,
      callOutlet,
      saveState,
      ithemLog,
      log,
      scheduleOutlet,
      scheduleInlet,
      triggerInlet,
      Now,
      Seconds,
      Minutes,
      Hours,
      Days,
      data,
      fetch,
      setTimeout: setTimeout,
      setInterval: setInterval,
      setImmediate: setImmediate,
    },
  });

  try {
    vm.run(inlet[0].code);
    return res.status(200).json({
      success: true,
      ithemLog: _log,
      data: [
        {
          id: eventID,
        },
        // {
        //   foundstatus: fStatus,
        // },
      ],
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      ithemLog: _log,
      error: typeof error === "object" && error.message ? error.message : error,
    });
  }
}
