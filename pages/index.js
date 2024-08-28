import { Layout, Menu, Typography, Space, Input, Row, Col } from "antd";
import {
  UserOutlined,
  LaptopOutlined,
  NotificationOutlined,
} from "@ant-design/icons";
import styles from "../styles/Home.module.css";
const { SubMenu } = Menu;
const { Title } = Typography;
import Controller from "../lib/controller";
const { Header, Content, Sider } = Layout;
import "antd/dist/antd.css";

export default function Home() {
  return (
    <>
      <div className={styles.container}>
        <title>iThem</title>
        <Row align="middle">
          <Col span={3}></Col>
          <Col align="middle" span={18}>
            <Title>Legato</Title>
            <p>SCRIPTING WITH TRIGGERS AND ACTIONS</p>
            <Controller></Controller>
          </Col>
          <Col span={3}></Col>
        </Row>
      </div>
    </>
  );
}
