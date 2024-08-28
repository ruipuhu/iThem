import {
    Typography,
    Row,
    Col,
    Button,
    List,
    Tooltip,
    message,
  } from "antd";
  import {
    CaretRightOutlined,
  } from "@ant-design/icons";
  import React, { useState, useEffect } from "react";
  import { useSession, signIn, signOut } from "next-auth/react";
  
  export default function Scheduled({runCount}) {
    const [scheduled, setScheduled] = useState([]);
    const { data: session } = useSession();
  
    useEffect(() => {
      updateScheduled();
    }, [runCount]);
  
    const updateScheduled = async (query) => {
      if (!session) return;
      const req = await fetch(`/api/scheduled?email=${session.user.email}`);
      const data = await req.json();
      setScheduled(data.message);
    };
  
    const handleRunNow = async (id) => {
      try {
        const req = await fetch(`/api/scheduled/run?id=${id}`, {method: "POST"});
        await req.json();  // Is this necessary?
        updateScheduled();
        message.success("ran scheduled action");
      } catch (error) {
        message.warning(error);
      }
    };
  
    const handleDelete = async (id) => {
      try {
        const req = await fetch(`/api/scheduled/delete?id=${id}`, {method: "DELETE"});
        await req.json();  // Is this necessary?
        updateScheduled();
        message.success("deleted scheduled action");
      } catch (error) {
        message.warning(error);
      }
    };

    let prettyTime = (t) => {
      let d = new Date(t);
      const offset = d.getTimezoneOffset();
      let yyyymmdd = new Date(d.getTime() - offset * 60 * 1000)
        .toISOString()
        .split("T")[0]
        .replaceAll("-", "/");

      let hh = d.getHours();
      if (hh < 10) hh = "0" + hh;
      let mm = d.getMinutes();
      if (mm < 10) mm = "0" + mm;

      return `${yyyymmdd} ${hh}:${mm}`
    };
  
  //   const handleDelete = async (query) => {
  //     try {
  //       const req = await fetch(`/api/outlets?id=${query}`, { method: "DELETE" });
  //       const data = await req.json();
  //       fetchOutlets();
  //       message.success("outlets deleted");
  //     } catch (error) {
  //       message.warning(error);
  //     }
  //   };
  
    return (
      <>
        <Row>
          <Col span={24}>
            <List
              itemLayout="horizontal"
              dataSource={scheduled}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  actions={[
                    <Tooltip
                      key="2"
                      title="Run now instead of at the scheduled time. Note this remove this action from the list of scheduled actions."
                    >
                      <Button
                        key="run"
                        type="primary"
                        onClick={() => handleRunNow(item._id)}
                      >
                        <CaretRightOutlined /> Run Now
                      </Button>
                    </Tooltip>,
                    <Button
                      danger
                      key="delete"
                      type="primary"
                      onClick={() => handleDelete(item._id)}
                    >
                      Delete
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Typography.Text >{scheduledItemToString(item)}</Typography.Text>}
                    description={`Scheduled: ${prettyTime(item.schedTime)}`}
                  />
                </List.Item>
              )}
            />
          </Col>
        </Row>
      </>
    );
  }
  
  function truncate(s) {
    let N = 20;
    s = ""+s;
    return s.length < N ? s : s.slice(0, N) + "...";
  }

  function scheduledItemToString(item) {
    if (item.outletName) {
      return item.outletArg !== null
        ? `callOutlet("${item.outletName}", "${truncate(item.outletArg)}")`
        : `callOutlet("${item.outletName}")`;
    } else if (item.inletName) {
      return item.inletArg !== null
        ? `triggerInlet("${item.inletName}", "${truncate(item.inletArg)}")`
        : `triggerInlet("${item.inletName}")`;
    }
    return "";
  }