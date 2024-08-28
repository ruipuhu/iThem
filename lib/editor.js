import dynamic from "next/dynamic";
import "@uiw/react-textarea-code-editor/dist.css";
import { Space, Button, message, Typography, Modal, Table } from "antd";

import { CaretRightOutlined, SaveOutlined } from "@ant-design/icons";
const CodeEditor = dynamic(
  () => import("@uiw/react-textarea-code-editor").then((mod) => mod.default),
  { ssr: false }
);
import React, { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

function Editor(props) {
  const [code, setCode] = useState(props.inlet.code);
  const [variables, setVariable] = useState([]);
  const { data: session, status } = useSession();
  const [outlets, setoutlets] = useState([]);
  const [data, setData] = useState();
  const [showHelp, setShowHelp] = useState(false);
  const [log, setLog] = useState([]);
  const [errorLog, setErrorLog] = useState("");

  const codeLog = log.join("\n") + (errorLog ? "\n" + errorLog : "");

  useEffect(() => {
    setCode(props.inlet.code);
  }, [props.inlet.code]);

  useEffect(() => {
    fetchVariable();
  }, []);

  useEffect(() => {
    fetchOutlets();
  }, []);

  const onSave = (values) =>
    new Promise((resolve, reject) => {
      const encoded = encodeURIComponent(code);

      fetch(`/api/inlets/update?code=${encoded}&id=${props.inlet._id}`, {
        method: "POST",
        body: JSON.stringify({
          code,
          inletId: props.inlet._id,
        }),
      })
        .then((res) => {
          console.log("fetching the inlets now");
          props.fetchinlet();
          message.success("Inlet Code Save Success");
          resolve();
        })
        .catch((error) => {
          message.error("Inlet Code Save Failed");
          reject();
        });
    });

  const fetchVariable = async (query) => {
    if (session) {
      const req = await fetch(`/api/var?email=${session.user.email}`);
      const data = await req.json();
      setVariable(data.message);
    }
  };

  const fetchOutlets = async (query) => {
    if (session) {
      const req = await fetch(`/api/outlets?email=${session.user.email}`);
      const data = await req.json();
      setoutlets(data.message);
    }
  };

  const handleInletLog = () => {
    const msg = "Inlet Ran Manually From Code Editor";
    const type = "inlet";
    fetch(
      `/api/events/create?email=${session.user.email}&name=${props.inlet.name}&note=${msg}&type=${type}`,
      {
        method: "POST",
      }
    );
  };

  return (
    <div style={{ paddingBottom: 35 }}>
      <Space style={{ marginBottom: 16, marginTop: 6 }}>
        <Button
          disabled={!props.inlet.name}
          onClick={() => {
            // Optionally save. If we do, wait for it to resolve
            let maybeSave =
              props.inlet && props.inlet.code !== code
                ? onSave()
                : Promise.resolve();

            maybeSave
              .then(() =>
                fetch(
                  `/api/ifttt/v1/actions/trigger_a_inlet?email=${
                    session.user.email
                  }&editor=${true}`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      actionFields: {
                        inlet: props.inlet.name,
                        data: data,
                      },
                    }),
                  }
                )
              )
              .then((res) => res.json())
              .then((data) => {
                props.onCodeRan(); // This triggers a reload of the states/variables
                setLog(Array.isArray(data.ithemLog) ? data.ithemLog : []);
                setErrorLog(data.error ? data.error : "");
                return data.error
                  ? message.error(`Inlet Execution Failed: ${data.error}`)
                  : message.success("inlet Executed Successfully");
              });
            handleInletLog();
          }}
          type="primary"
        >
          <CaretRightOutlined /> Run
        </Button>
        <Button
          disabled={!props.inlet.name || props.inlet.code === code}
          onClick={() => {
            onSave();
          }}
          type="primary"
        >
          <SaveOutlined /> Save My Code
        </Button>
        <Button type="dashed" onClick={() => setShowHelp(true)}>
          API (?)
        </Button>
      </Space>
      <CodeEditor
        value={code}
        language="js"
        placeholder="Please enter JS code. //to use data simply referencing 'data'"
        onChange={(evn) => {
          // Get rid of the start-end quotes and replace w/ the char <">, which actually works in code lol.
          // Kind of a hack, but this was a bug in the pilot study....
          let val = evn.target.value;
          val = val.replaceAll("“", '"');
          val = val.replaceAll("”", '"');
          setCode(val);
        }}
        padding={15}
        minHeight={120}
        style={{
          fontSize: 12,
          backgroundColor: "#f5f5f5",
          fontFamily:
            "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
        }}
      />

      <Typography.Title level={5} style={{ margin: 2 }}>
        Test Data
      </Typography.Title>
      <CodeEditor
        value={data}
        language="js"
        placeholder="type your data passed from IFTTT to Legato for a test run"
        onChange={(evn) => {
          setData(evn.target.value);
        }}
        minHeight={20}
        padding={15}
        style={{
          fontSize: 12,
          backgroundColor: "#f5f5f5",
          fontFamily:
            "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
        }}
      />
      <Typography.Title level={5} style={{ margin: 2 }}>
        Code Logs
      </Typography.Title>
      <CodeEditor
        value={codeLog}
        disabled={true}
        placeholder="log() statements and errors show up here"
        onChange={(evn) => {}}
        minHeight={20}
        padding={15}
        style={{
          fontSize: 12,
          backgroundColor: "#f5f5f5",
          fontFamily:
            "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
        }}
      />
      <Modal
        title="Legato API"
        visible={showHelp}
        footer={null}
        onCancel={() => setShowHelp(false)}
        width={700}
      >
        <Table
          pagination={false}
          columns={[
            {
              title: "function",
              dataIndex: "function",
              key: "function",
              width: 300,
              render: (text) => (
                <Typography.Text code={true} copyable={true}>
                  {text}
                </Typography.Text>
              ),
            },
            {
              title: "description",
              dataIndex: "description",
              key: "description",
              render: (text) => <Typography.Text>{text}</Typography.Text>,
            },
          ]}
          dataSource={[
            {
              function: `loadState("stateName")`,
              description: `Loads the state with the name "stateName".`,
            },
            {
              function: `saveState("stateName", value)`,
              description: `Saves the value 'value' to the state named "stateName".`,
            },
            {
              function: `callOutlet("outletName", data)`,
              description: `Calls the outlet with name "outletName". If parameter 'data' is provided,
            it will be passed to IFTTT as a string.`,
            },
            {
              function: `log(statement)`,
              description: `Can be used for debugging, similarly to console.log().
            Prints the given statement in the section "Code Logs."
            Can accept multiple arguments, which will be separated by a space when displayed.`,
            },
            {
              function: `scheduleOutlet("outletName", time, data)`,
              description: `Calls the outlet with the name "outletName" at the given time. If parameter
            'data' is provided, it will be passed to IFTTT as a string. To define the time, you can
            use the functions Now() along with Minutes, Hours, Seconds, or Days, e.g., 'Now() + Hours(4)'.`,
            },
          ]}
        />
      </Modal>
    </div>
  );
}

export default Editor;
