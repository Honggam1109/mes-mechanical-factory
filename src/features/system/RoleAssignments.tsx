import { useEffect, useState } from "react"
import { Button, Checkbox, Input, Select, Space, Tag, message } from "antd"
import DataTable from "../../components/shared/DataTable"
import type { ColumnsType } from "antd/es/table"
import { useAuth } from "../auth/AuthContext"
import { systemService } from "./service"
import type {
  DataPermission,
  Permission,
  PermissionAction,
  Role,
  User,
} from "./types"
import type { Options } from "./useSystemData"
export default function RoleAssignments({
  tab,
  role,
  options,
  readonly,
  onReload,
}: {
  tab: "users" | "permissions" | "data-permissions"
  role: Role
  options: Options
  readonly: boolean
  onReload: () => Promise<void>
}) {
  const { hasPermission, refresh } = useAuth(),
    [saving, setSaving] = useState(false),
    [search, setSearch] = useState("")
  const [userIds, setUserIds] = useState(role.userIds),
    [permissions, setPermissions] = useState(role.permissions),
    [dataIds, setDataIds] = useState(role.dataPermissionIds)
  useEffect(() => {
    setUserIds(role.userIds)
    setPermissions(role.permissions)
    setDataIds(role.dataPermissionIds)
  }, [role])
  const canView = hasPermission(
    tab === "users"
      ? "SYSTEM_USER"
      : tab === "permissions"
        ? "SYSTEM_PERMISSION"
        : "SYSTEM_DATA_PERMISSION",
    "VIEW",
  )
  const disabled =
    readonly ||
    saving ||
    !canView ||
    (tab === "users" && !hasPermission("SYSTEM_USER", "UPDATE"))
  if (!canView) return <div>Bạn không có quyền xem dữ liệu này.</div>
  const save = async () => {
    if (disabled) return
    setSaving(true)
    try {
      await systemService.assign(
        "roles",
        role.id,
        tab,
        tab === "users"
          ? { userIds }
          : tab === "permissions"
            ? { permissions }
            : { dataPermissionIds: dataIds },
      )
      message.success("Đã lưu phân quyền.")
      await onReload()
      await refresh()
    } catch (e) {
      message.error(
        e instanceof Error ? e.message : "Không thể lưu phân quyền.",
      )
    } finally {
      setSaving(false)
    }
  }
  const visible = (text: string) =>
    text.toLowerCase().includes(search.toLowerCase())
  const userColumns: ColumnsType<User> = [
    { title: "TÊN ĐĂNG NHẬP", dataIndex: "username" },
    { title: "HỌ VÀ TÊN", dataIndex: "fullName" },
    { title: "EMAIL", dataIndex: "email" },
    {
      title: "THAO TÁC",
      render: (_, u) => (
        <Button
          danger
          disabled={disabled}
          onClick={() => setUserIds((ids) => ids.filter((id) => id !== u.id))}
        >
          Bỏ khỏi vai trò
        </Button>
      ),
    },
  ]
  const permissionColumns: ColumnsType<Permission> = [
    {
      title: "TÀI NGUYÊN",
      render: (_, p) => (
        <Space direction="vertical">
          <strong>{p.code}</strong>
          <span>{p.name}</span>
        </Space>
      ),
    },
    {
      title: "ACTIONS",
      render: (_, p) => (
        <Checkbox.Group
          disabled={disabled || p.status !== "ACTIVE"}
          value={permissions[p.id] || []}
          options={p.actions.map((action) => ({
            label: action,
            value: action,
          }))}
          onChange={(values) =>
            setPermissions((old) => ({
              ...old,
              [p.id]: values as PermissionAction[],
            }))
          }
        />
      ),
    },
    {
      title: "THAO TÁC",
      render: (_, p) => (
        <Button
          danger
          disabled={disabled}
          onClick={() => setPermissions((old) => ({ ...old, [p.id]: [] }))}
        >
          Bỏ quyền
        </Button>
      ),
    },
  ]
  const dataColumns: ColumnsType<DataPermission> = [
    { title: "MÃ QUYỀN", dataIndex: "code" },
    { title: "TÊN", dataIndex: "name" },
    { title: "TÀI NGUYÊN", dataIndex: "resource" },
    { title: "LOẠI TRUY CẬP", dataIndex: "accessType" },
    { title: "PHẠM VI", render: (_, p) => <Tag color="blue">{p.scope}</Tag> },
    {
      title: "THAO TÁC",
      render: (_, p) => (
        <Button
          danger
          disabled={disabled}
          onClick={() => setDataIds((old) => old.filter((id) => id !== p.id))}
        >
          Bỏ quyền
        </Button>
      ),
    },
  ]
  return (
    <>
      <Space
        wrap
        style={{
          marginBottom: 16,
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        <Input.Search
          allowClear
          placeholder="Tìm kiếm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <Button
          type="primary"
          loading={saving}
          disabled={disabled}
          onClick={() => void save()}
        >
          Lưu {tab === "users" ? "người dùng" : "phân quyền"}
        </Button>
      </Space>
      {tab === "users" ? (
        <>
          <Select
            disabled={disabled || role.status !== "ACTIVE"}
            style={{ width: "100%", marginBottom: 16 }}
            placeholder="Thêm người dùng vào vai trò"
            showSearch
            optionFilterProp="label"
            value={undefined}
            options={options.users
              .filter((u) => !userIds.includes(u.id))
              .map((u) => ({
                value: u.id,
                label: `${u.username} – ${u.fullName}`,
              }))}
            onChange={(id) => {
              if (id) setUserIds((old) => [...old, id])
            }}
          />
          <DataTable
            rowKey="id"
            columns={userColumns}
            dataSource={options.users.filter(
              (u) =>
                userIds.includes(u.id) &&
                visible(`${u.username} ${u.fullName} ${u.email}`),
            )}
            scroll={{ x: 700 }}
          />
        </>
      ) : tab === "permissions" ? (
        <DataTable
          rowKey="id"
          columns={permissionColumns}
          dataSource={options.permissions.filter(
            (p) =>
              (p.status === "ACTIVE" || !!permissions[p.id]?.length) &&
              visible(`${p.code} ${p.name}`),
          )}
          scroll={{ x: 900 }}
        />
      ) : (
        <>
          <Select
            disabled={disabled}
            showSearch
            optionFilterProp="label"
            value={undefined}
            placeholder="Thêm quyền dữ liệu"
            style={{ width: "100%", marginBottom: 16 }}
            options={options.dataPermissions
              .filter((p) => p.status === "ACTIVE" && !dataIds.includes(p.id))
              .map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))}
            onChange={(id) => {
              if (id) setDataIds((old) => [...old, id])
            }}
          />
          <DataTable
            rowKey="id"
            columns={dataColumns}
            dataSource={options.dataPermissions.filter(
              (p) => dataIds.includes(p.id) && visible(`${p.code} ${p.name}`),
            )}
            scroll={{ x: 900 }}
          />
        </>
      )}
    </>
  )
}
