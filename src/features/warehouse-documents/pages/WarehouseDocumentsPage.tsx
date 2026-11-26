import StatusTag from "@/components/shared/StatusTag"
import { DeleteOutlined } from "@ant-design/icons"
import DocumentDetail from "../components/DocumentDetail"
import ConfirmDeleteDialog from "../../../components/shared/ConfirmDeleteDialog"
import { nextDocumentCode } from "../lib/documentData"
import type { WarehouseDocument } from "../types/document"
import { useState } from "react"
import { Card, Col, DatePicker, Form, Input, Row, Select, message, Button, Space } from "antd"
import { SearchOutlined } from "@ant-design/icons"
import FilterPanel, { FilterActions } from "../../../components/shared/FilterPanel"
import DataTable from "../../../components/shared/DataTable"
import DataToolbar from "../../../components/shared/DataToolbar"
import CreateDocumentButton from "../../../components/shared/CreateDocumentButton"
import { AppConfig } from "../../../app/config/theme"
import { documentTypes, documentStatuses, warehouses } from "../config/documentOptions"
import { mockDocuments } from "../mocks/documents"
import { filterDocuments } from "../lib/filterDocuments"
import type { DocumentFilters } from "../types/document"

const displayDate = (date: string) => date.split("-").reverse().join("/")
export default function WarehouseDocumentsPage() {
  const [documents, setDocuments] = useState(() => mockDocuments.map(row => ({ ...row, lines: [{ productId: "1", quantity: 1 }] } as WarehouseDocument)))
  const [detail, setDetail] = useState<{ id?: string; type: string } | null>(null)
  const [deleting, setDeleting] = useState<WarehouseDocument | null>(null)
  const [form] = Form.useForm()
  const [filters, setFilters] = useState<DocumentFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const rows = filterDocuments(documents, filters)
  const search = () => {
    const { dateRange, ...values } = form.getFieldsValue()
    setFilters({ ...values, dateRange: dateRange ? [dateRange[0].format("YYYY-MM-DD"), dateRange[1].format("YYYY-MM-DD")] : undefined })
    setPage(1)
  }
  const record = detail?.id ? documents.find(row => row.id === detail.id) ?? null : null
  if (detail) return <DocumentDetail key={detail.id ?? detail.type} record={record} type={detail.type} code={record?.code ?? nextDocumentCode(documents, detail.type)} onBack={() => setDetail(null)}
    onSave={(values, lines) => { const id = record?.id ?? crypto.randomUUID(); setDocuments(previous => record ? previous.map(row => row.id === id ? { ...row, ...values, lines } : row) : [{ id, type: detail.type, code: nextDocumentCode(previous, detail.type), status: "draft", ...values, lines }, ...previous]); setDetail({ id, type: detail.type }); message.success("Đã lưu nháp.") }}
    onConfirm={() => { setDocuments(previous => previous.map(row => row.id === record?.id && row.status === "draft" ? { ...row, status: "waiting", confirmedAt: new Date().toISOString() } : row)); message.success("Chứng từ đã chuyển sang Đang chờ.") }} />
  return <>
    {deleting && <ConfirmDeleteDialog open content={`Xóa chứng từ ${deleting.code}? Thao tác này không thể hoàn tác.`} onCancel={() => setDeleting(null)} onConfirm={() => setDocuments(previous => previous.filter(row => row.id !== deleting.id || row.status !== "draft"))} />}
    <FilterPanel><Form form={form} layout="vertical"><Row gutter={AppConfig.theme.light.layout.filterGap}>
      <Col xs={24} md={8}><Form.Item name="code" label="Mã chứng từ"><Input allowClear prefix={<SearchOutlined />} placeholder="Nhập mã chứng từ..." onPressEnter={search} /></Form.Item></Col>
      <Col xs={24} md={8}><Form.Item name="type" label="Loại chứng từ"><Select allowClear placeholder="Tất cả" options={documentTypes} /></Form.Item></Col>
      <Col xs={24} md={8}><Form.Item name="status" label="Trạng thái"><Select allowClear placeholder="Tất cả" options={documentStatuses} /></Form.Item></Col>
      <Col xs={24} md={8}><Form.Item name="dateRange" label="Khoảng ngày dự kiến"><DatePicker.RangePicker format="DD/MM/YYYY" placeholder={["Từ ngày", "Đến ngày"]} style={{ width: "100%" }} /></Form.Item></Col>
      <Col xs={24} md={8}><Form.Item name="destinationWarehouse" label="Kho đích"><Select allowClear placeholder="Tất cả" options={warehouses} /></Form.Item></Col>
      <Col xs={24} md={8}><Form.Item name="sourceWarehouse" label="Kho nguồn"><Select allowClear placeholder="Tất cả" options={warehouses} /></Form.Item></Col>
    </Row><Row><Col span={24} style={{ display: "flex", justifyContent: "flex-end" }}><FilterActions onSearch={search} onReset={() => { form.resetFields(); setFilters({}); setPage(1) }} /></Col></Row></Form></FilterPanel>
    <Card bordered={false}><DataToolbar total={rows.length} recordLabel="chứng từ"><CreateDocumentButton types={documentTypes} onSelect={type => setDetail({ type })} /></DataToolbar>
      <DataTable rowKey="id" dataSource={rows} scroll={{ x: 850 }} columns={[
        { title: "Mã chứng từ", dataIndex: "code", render: (code: string, row: WarehouseDocument) => <a onClick={() => setDetail({ id: row.id, type: row.type })}>{code}</a> },
        { title: "Loại chứng từ", dataIndex: "type", render: type => documentTypes.find(option => option.value === type)?.label },
        { title: "Ngày dự kiến", dataIndex: "plannedDate", render: displayDate },
        { title: "Thời điểm cần thực hiện", dataIndex: "requiredAt", render: (value: string) => `${displayDate(value.split("T")[0])} ${value.split("T")[1]}` },
        { title: "Trạng thái", dataIndex: "status", render: value => { const status = documentStatuses.find(option => option.value === value); return <StatusTag color={status?.color}>{status?.label}</StatusTag> } },
        { title: "Hành động", render: (_, row: WarehouseDocument) => <Space>{row.status === "draft" && <Button title="Xóa" type="text" danger icon={<DeleteOutlined />} onClick={() => setDeleting(row)} />}</Space> },
      ]} pagination={{ current: Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize))), pageSize, onChange: (next, size) => { setPage(size === pageSize ? next : 1); setPageSize(size) } }} />
    </Card>
  </>
}
