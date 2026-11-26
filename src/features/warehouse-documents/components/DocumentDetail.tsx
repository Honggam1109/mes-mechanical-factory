import DocumentStatusHeader from "./DocumentStatusHeader"
import AddButton from "../../../components/shared/AddButton"
import { useRef, useState } from "react"
import { Select,  Button, Card, Col, Form, Input, InputNumber, Modal, Row, Space, Typography, message } from "antd"
import { CheckOutlined, DeleteOutlined } from "@ant-design/icons"
import FormHeader from "../../../components/shared/FormHeader"
import FormToolbar from "../../../components/shared/FormToolbar"
import DataTable from "../../../components/shared/DataTable"
import DataToolbar from "../../../components/shared/DataToolbar"
import { productMockData } from "../../products/mocks/products"
import { warehouses } from "../config/documentOptions"
import { availableStock, validateDocument } from "../lib/documentData"
import type { DocumentValues, DocumentLine, WarehouseDocument } from "../types/document"

export default function DocumentDetail({ record, type, code, onBack, onSave, onConfirm }: {
  record: WarehouseDocument | null; type: string; code: string; onBack: () => void;
  onSave: (values: DocumentValues, lines: DocumentLine[]) => void; onConfirm: () => void
}) {
  const initial: DocumentValues = { plannedDate: record?.plannedDate ?? "", requiredAt: record?.requiredAt ?? "", sourceWarehouse: type === "receipt" ? "" : record?.sourceWarehouse ?? "", destinationWarehouse: type === "issue" ? "" : record?.destinationWarehouse ?? "" }
  const [form] = Form.useForm<DocumentValues>()
  const [lines, setLines] = useState<DocumentLine[]>(() => structuredClone(record?.lines ?? []))
  const source = Form.useWatch("sourceWarehouse", form)
  const [picker, setPicker] = useState(false)
  const [selected, setSelected] = useState<React.Key[]>([])
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const locked = !!record && record.status !== "draft"
  const reset = () => { form.resetFields(); setLines(structuredClone(record?.lines ?? [])) }
  const perform = async (confirm: boolean) => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try {
      const values = await form.validateFields()
      validateDocument(type, values, lines, confirm)
      if (confirm) {
        if (!record || JSON.stringify(values) !== JSON.stringify(initial) || JSON.stringify(lines) !== JSON.stringify(record.lines ?? [])) throw new Error("Vui lòng lưu thay đổi trước khi xác nhận.")
        onConfirm()
      } else onSave(values, lines)
    } catch (error) { if (error instanceof Error) message.error(error.message) }
    finally { setBusy(false); pending.current = false }
  }
  const goods = lines.map(line => ({ ...line, product: productMockData.find(product => product.key === line.productId) }))
  return <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
    <Card bordered={false}>
      <FormHeader onBack={onBack} onReset={reset} onSave={() => void perform(false)} actions={locked ? null : <Space wrap>
        <FormToolbar disabled={busy} saving={busy} saveText="Lưu nháp" onReset={reset} onSave={() => void perform(false)} />
        {record && <Button type="primary" icon={<CheckOutlined />} disabled={busy} onClick={() => void perform(true)}>Xác nhận</Button>}
      </Space>} />
      <DocumentStatusHeader code={code} type={type} status={record?.status} confirmedAt={record?.confirmedAt} />
    </Card>
    <Card bordered={false} title="Thông tin chứng từ"><Form form={form} layout="vertical" initialValues={initial} disabled={locked || busy}>
      <Row gutter={24}>
        <Col xs={24} md={8}><Form.Item label="Mã chứng từ"><Input readOnly value={code} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item name="plannedDate" label="Ngày dự kiến" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item name="requiredAt" label="Thời điểm cần thực hiện" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="sourceWarehouse" label="Kho nguồn"><Select disabled={locked || busy || type === "receipt"} options={warehouses} placeholder={type === "receipt" ? "Không áp dụng" : "Chọn kho nguồn"} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="destinationWarehouse" label="Kho đích"><Select disabled={locked || busy || type === "issue"} options={warehouses} placeholder={type === "issue" ? "Không áp dụng" : "Chọn kho đích"} /></Form.Item></Col>
      </Row>
    </Form></Card>
    <Card bordered={false}><DataToolbar total={lines.length} recordLabel="mặt hàng">{!locked && <AddButton disabled={busy}  onClick={() => { setSelected([]); setPicker(true) }}>Thêm sản phẩm</AddButton>}</DataToolbar>
      <DataTable rowKey="productId" dataSource={goods} pagination={false} scroll={{ x: 750 }} columns={[
        { title: "Sản phẩm", render: (_, row) => <><Typography.Text strong>{row.product?.code}</Typography.Text><br />{row.product?.name}</> },
        { title: "Đơn vị", render: (_, row) => row.product?.unit },
        { title: "Tồn khả dụng", render: (_, row) => type === "receipt" ? "Không áp dụng" : source ? availableStock(row.productId, source) : "—" },
        { title: "Số lượng", render: (_, row) => <InputNumber min={0.001} value={row.quantity} disabled={locked || busy} status={type !== "receipt" && source && row.quantity > availableStock(row.productId, source) ? "error" : undefined} onChange={value => setLines(previous => previous.map(line => line.productId === row.productId ? { ...line, quantity: value ?? 0 } : line))} /> },
        { title: "Thao tác", render: (_, row) => !locked && <Button title="Xóa dòng" disabled={busy} type="text" danger icon={<DeleteOutlined />} onClick={() => setLines(previous => previous.filter(line => line.productId !== row.productId))} /> },
      ]} />
    </Card>
    <Modal open={picker} title="Chọn sản phẩm" width={800} onCancel={() => setPicker(false)} okText="Thêm sản phẩm" cancelText="Hủy" okButtonProps={{ disabled: !selected.length }} onOk={() => { setLines(previous => [...previous, ...selected.filter(id => !previous.some(line => line.productId === id)).map(id => ({ productId: String(id), quantity: 1 }))]); setPicker(false) }}>
      <DataTable rowKey="key" dataSource={productMockData.filter(product => product.status === "Hoạt động")} rowSelection={{ selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: product => ({ disabled: lines.some(line => line.productId === product.key) }) }} columns={[{ title: "Mã", dataIndex: "code" }, { title: "Sản phẩm", dataIndex: "name" }, { title: "Đơn vị", dataIndex: "unit" }]} />
    </Modal>
  </div>
}
