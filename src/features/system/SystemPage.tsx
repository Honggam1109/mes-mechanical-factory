import StatusTag from "@/components/shared/StatusTag"
import { useEffect, useState } from "react"
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  message,
} from "antd"
import {
  EditOutlined,
  LockOutlined,
  ReloadOutlined,
  KeyOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import DataTable from "../../components/shared/DataTable"
import DataToolbar from "../../components/shared/DataToolbar"
import FilterPanel, { FilterActions } from "../../components/shared/FilterPanel"
import AddButton from "../../components/shared/AddButton"
import { navigate, useAuth, usePathname } from "../auth/AuthContext"
import useSystemData from "./useSystemData"
import { systemService } from "./service"
import {
  labels,
  resources,
  type EntityKind,
  type Filter,
  type SystemRecord,
  type User,
  type Role,
  type Permission,
  type DataPermission,
} from "./types"
import SystemForm from "./SystemForm"
import PasswordModal from "./PasswordModal"
export const statusOptions = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "INACTIVE", label: "Không hoạt động" },
]
export const statusTag = (status: string) => (
  <StatusTag color={status === "ACTIVE" ? "success" : "default"}>
    {status === "ACTIVE" ? "Hoạt động" : "Không hoạt động"}
  </StatusTag>
)
export default function SystemPage({ kind }: { kind: EntityKind }) {
  const path = usePathname(),
    active = path.startsWith(`/system/${kind}`),
    id = active ? path.split("/")[3] : undefined
  const { hasPermission, refresh } = useAuth(),
    resource = resources[kind]
  const state = useSystemData(kind, id),
    [filterForm] = Form.useForm<Filter>(),
    [modal, holder] = Modal.useModal(),
    [passwordUser, setPasswordUser] = useState<User>(),
    [busy, setBusy] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  useEffect(() => {
    if (
      active &&
      (!hasPermission(resource, "VIEW") ||
        (id === "new" && !hasPermission(resource, "CREATE")))
    )
      navigate("/403", true)
  }, [active, id, resource, hasPermission])
  if (!hasPermission(resource, "VIEW"))
    return <Result status="403" title="403" />
  const open = (row?: SystemRecord, view = false) => {
    setViewOnly(view)
    navigate(`/system/${kind}/${row?.id || "new"}`)
  }
  const mutate = async (callback: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    try {
      await callback()
      message.success("Đã cập nhật thành công.")
      await state.reload()
      await refresh()
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Không thể cập nhật.")
    } finally {
      setBusy(false)
    }
  }
  const toggle = (row: SystemRecord) =>
    modal.confirm({
      title: row.status === "ACTIVE" ? "Ngừng hoạt động?" : "Mở hoạt động?",
      content: kind === "users" ? (row as User).username : (row as Role).name,
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: async () => {
        if (busy) return
        setBusy(true)
        try {
          if (kind === "users")
            await systemService.assign(
              kind,
              row.id,
              "status",
              { status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
              "PATCH",
            )
          else
            await systemService.save(
              kind,
              { status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
              row.id,
            )
          message.success("Đã cập nhật trạng thái.")
          await state.reload()
          await refresh()
        } catch (e) {
          message.error(e instanceof Error ? e.message : "Không thể cập nhật.")
          throw e
        } finally {
          setBusy(false)
        }
      },
    })
  const columns: ColumnsType<SystemRecord> =
    kind === "users"
      ? [
          {
            title: "TÊN ĐĂNG NHẬP",
            render: (_, row) => (
              <Button type="link" onClick={() => open(row, true)}>
                {(row as User).username}
              </Button>
            ),
          },
          { title: "HỌ VÀ TÊN", dataIndex: "fullName" },
          { title: "EMAIL", dataIndex: "email" },
          {
            title: "VAI TRÒ",
            render: (_, row) =>
              (row as User).roleIds.map((id) => (
                <Tag key={id}>
                  {state.options.roles.find((r) => r.id === id)?.name || id}
                </Tag>
              )),
          },
          {
            title: "NGÀY TẠO",
            dataIndex: "createdAt",
            render: (v: string) => new Date(v).toLocaleString("vi-VN"),
          },
          {
            title: "NGÀY CẬP NHẬT",
            dataIndex: "updatedAt",
            render: (v: string) => new Date(v).toLocaleString("vi-VN"),
          },
        ]
      : [
          {
            title: kind === "roles" ? "MÃ VAI TRÒ" : "MÃ QUYỀN",
            dataIndex: "code",
            render: (value: string, row) => (
              <Button type="link" onClick={() => open(row, true)}>
                {value}
              </Button>
            ),
          },
          { title: "TÊN", dataIndex: "name" },
          ...(kind === "roles"
            ? [
                { title: "MÔ TẢ", dataIndex: "description" },
                { title: "SỐ NGƯỜI DÙNG", dataIndex: "userCount" },
              ]
            : kind === "permissions"
              ? [
                  { title: "MODULE", dataIndex: "module" },
                  { title: "ĐƯỜNG DẪN", dataIndex: "route" },
                  {
                    title: "ACTIONS",
                    render: (_: unknown, row: SystemRecord) =>
                      (row as Permission).actions.map((a) => (
                        <Tag key={a}>{a}</Tag>
                      )),
                  },
                ]
              : [
                  { title: "TÀI NGUYÊN", dataIndex: "resource" },
                  { title: "LOẠI TRUY CẬP", dataIndex: "accessType" },
                  {
                    title: "PHẠM VI",
                    render: (_: unknown, row: SystemRecord) => (
                      <Tag color="blue">{(row as DataPermission).scope}</Tag>
                    ),
                  },
                ]),
        ]
  columns.push(
    { title: "TRẠNG THÁI", dataIndex: "status", render: statusTag },
    {
      title: "THAO TÁC",
      fixed: "right",
      width: 190,
      render: (_, row) => (
        <Space size={0}>
          
          {hasPermission(resource, "UPDATE") && (
            <Button
              title="Sửa"
              icon={<EditOutlined />}
              type="text"
              onClick={() => open(row)}
            />
          )}
          {hasPermission(resource, kind === "users" ? "LOCK" : "UPDATE") && (
            <Button
              title={
                row.status === "ACTIVE" ? "Ngừng hoạt động" : "Mở hoạt động"
              }
              disabled={busy}
              icon={<LockOutlined />}
              type="text"
              onClick={() => toggle(row)}
            />
          )}
          {kind === "users" && hasPermission(resource, "RESET_PASSWORD") && (
            <Button
              title="Reset mật khẩu"
              type="text"
              icon={<KeyOutlined />}
              onClick={() => setPasswordUser(row as User)}
            />
          )}
        </Space>
      ),
    },
  )
  if (id)
    return (
      <>
        {holder}
        {state.loading ? (
          <Spin />
        ) : state.error ? (
          <Alert
            type="error"
            title={state.error}
            action={
              <Button onClick={() => void state.reload()}>Thử lại</Button>
            }
          />
        ) : (
          <SystemForm
            key={`${kind}/${id}`}
            kind={kind}
            record={state.record}
            options={state.options}
            viewOnly={
              viewOnly || (id !== "new" && !hasPermission(resource, "UPDATE"))
            }
            onEdit={() => setViewOnly(false)}
            saving={busy}
            onBack={() => {
              setViewOnly(false)
              navigate(`/system/${kind}`)
            }}
            onSave={(values) =>
              mutate(async () => {
                await systemService.save(
                  kind,
                  values,
                  id === "new" ? undefined : id,
                )
                setViewOnly(false)
                navigate(`/system/${kind}`)
              })
            }
            onReload={state.reload}
          />
        )}
      </>
    )
  return (
    <>
      {holder}
      <FilterPanel>
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={(values) =>
            state.setFilters({
              ...values,
              page: 1,
              pageSize: state.filters.pageSize,
            })
          }
        >
          <Row gutter={16}>
            {(kind === "users"
              ? [
                  ["username", "Tên đăng nhập"],
                  ["fullName", "Họ và tên"],
                  ["email", "Email"],
                ]
              : [["keyword", "Mã / tên"]]
            ).map(([key, label]) => (
              <Col xs={24} md={kind === "users" ? 6 : 12} key={key}>
                <Form.Item name={key} label={label}>
                  <Input allowClear onPressEnter={() => filterForm.submit()} />
                </Form.Item>
              </Col>
            ))}
            <Col xs={24} md={6}>
              <Form.Item name="status" label="Trạng thái">
                <Select
                  allowClear
                  placeholder="Tất cả"
                  options={statusOptions}
                />
              </Form.Item>
            </Col>
            {kind === "users" && (
              <Col xs={24} md={6}>
                <Form.Item name="roleId" label="Vai trò">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={state.options.roles.map((r) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                  />
                </Form.Item>
              </Col>
            )}
          </Row>
          <div style={{ textAlign: "right" }}>
            <FilterActions
              loading={state.loading}
              onSearch={() => filterForm.submit()}
              onReset={() => {
                filterForm.resetFields()
                state.setFilters({ page: 1, pageSize: 10 })
              }}
            />
          </div>
        </Form>
      </FilterPanel>
      <Card bordered={false}>
        <DataToolbar
          total={state.data.total}
          recordLabel={labels[kind].toLowerCase()}
        >
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={state.loading}
              onClick={() => void state.reload()}
            >
              Tải lại
            </Button>
            {hasPermission(resource, "CREATE") && (
              <AddButton onClick={() => open()} />
            )}
          </Space>
        </DataToolbar>
        {state.error && (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            title={state.error}
            action={
              <Button onClick={() => void state.reload()}>Thử lại</Button>
            }
          />
        )}
        <DataTable<SystemRecord>
          rowKey="id"
          columns={columns}
          dataSource={state.data.items}
          loading={state.loading}
          scroll={{ x: kind === "users" ? 1350 : 1000 }}
          pagination={{
            total: state.data.total,
            current: state.filters.page,
            pageSize: state.filters.pageSize,
            onChange: (page, pageSize) =>
              state.setFilters({ ...state.filters, page, pageSize }),
          }}
        />
      </Card>
      <PasswordModal
        userId={passwordUser?.id}
        open={!!passwordUser}
        onClose={() => setPasswordUser(undefined)}
      />
    </>
  )
}
