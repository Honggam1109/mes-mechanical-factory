import Select from "@/components/shared/SelectableSelect"
import { useEffect, useRef, useState, type ReactNode } from "react"

import {
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Tabs,
  Upload,
  message,
} from "antd"

import { PictureOutlined, UserOutlined } from "@ant-design/icons"

import FormHeader from "../../components/shared/FormHeader"

import { useAuth } from "../auth/AuthContext"

import {
  actions,
  labels,
  resources,
  type EntityKind,
  type SystemRecord,
  type User,
  type Role,
} from "./types"

import type { Rule } from "antd/es/form"

import type { Options } from "./useSystemData"

import { passwordRule } from "./PasswordModal"

import RoleAssignments from "./RoleAssignments"

const statuses = [
  { value: "ACTIVE", label: "Hoạt động" },

  { value: "INACTIVE", label: "Không hoạt động" },
]

const required: Rule[] = [
  { required: true, message: "Vui lòng nhập thông tin." },
]

export default function SystemForm({
  kind,

  record,

  options,

  viewOnly,

  onEdit,

  saving,

  onBack,

  onSave,

  onReload,
}: {
  kind: EntityKind

  record?: SystemRecord

  options: Options

  viewOnly: boolean

  onEdit: () => void

  saving: boolean

  onBack: () => void

  onSave: (values: Record<string, unknown>) => Promise<void>

  onReload: () => Promise<void>
}) {
  const [form] = Form.useForm<Record<string, unknown>>(),
    { hasPermission } = useAuth(),
    [avatar, setAvatar] = useState((record as User | undefined)?.avatar)

  const employeeId = Form.useWatch("employeeId", form) as string | undefined
  const currentEmployee = (record as User | undefined)?.employee
  const employeeChoices = [
    ...options.employees,
    ...(currentEmployee &&
    !options.employees.some((e) => e.id === currentEmployee.id)
      ? [{ ...currentEmployee, linkedUserId: record?.id }]
      : []),
  ]
  const employee = employeeChoices.find((e) => e.id === employeeId)

  const initial = record
    ? { ...record }
    : {
        status: "ACTIVE",

        roleIds: [],

        actions: ["VIEW"],

        accessType: "VIEW",

        scope: "SELF",

        module: "SYSTEM",
      }

  useEffect(() => {
    form.setFieldsValue(initial)
  }, [record, form])

  const editAllowed = hasPermission(
    resources[kind],

    record ? "UPDATE" : "CREATE",
  )

  const reset = () => {
    form.resetFields()

    form.setFieldsValue(initial)

    setAvatar((record as User | undefined)?.avatar)
  }

  const pending = useRef(false)

  const save = async () => {
    if (saving || pending.current) return

    pending.current = true

    try {
      await onSave({ ...(await form.validateFields()), avatar: avatar || "" })
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      pending.current = false
    }
  }

  const field = (
    name: string,

    label: string,

    child: ReactNode,

    rules = required,
  ) => (
    <Col xs={24} md={12} key={name}>
      <Form.Item name={name} label={label} rules={rules}>
        {child}
      </Form.Item>
    </Col>
  )

  const information = (
    <Form form={form} layout="vertical" disabled={viewOnly || saving}>
      <Row gutter={24}>
        {kind === "users" ? (
          <>
            <Col xs={24} md={6}>
              <div style={{ textAlign: "center", padding: 24 }}>
                <Avatar size={100} src={avatar} icon={<UserOutlined />} />
                <div style={{ marginTop: 16 }}>
                  <Upload
                    disabled={viewOnly || saving}
                    accept="image/png,image/jpeg,image/webp"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      if (
                        !["image/png", "image/jpeg", "image/webp"].includes(
                          file.type,
                        ) ||
                        file.size > 2 * 1024 * 1024
                      ) {
                        message.error("Ảnh phải là PNG/JPEG/WebP, tối đa 2 MB.")

                        return false
                      }

                      const reader = new FileReader()

                      reader.onload = () => setAvatar(String(reader.result))

                      reader.readAsDataURL(file)

                      return false
                    }}
                  >
                    <Button icon={<PictureOutlined />}>Tải ảnh</Button>
                  </Upload>
                  {avatar && (
                    <Button
                      type="link"
                      disabled={viewOnly || saving}
                      onClick={() => setAvatar(undefined)}
                    >
                      Bỏ ảnh
                    </Button>
                  )}
                </div>
              </div>
            </Col>
            <Col xs={24} md={18}>
              <Row gutter={24}>
                {field(
                  "username",

                  "Tên đăng nhập",

                  <Input readOnly={!!record} autoComplete="off" />,

                  [
                    { required: true, message: "Vui lòng nhập tên đăng nhập." },

                    {
                      pattern: /^\S{4,50}$/,

                      message:
                        "Tên đăng nhập phải có 4–50 ký tự, không khoảng trắng.",
                    },
                  ],
                )}
                {field(
                  "status",

                  "Trạng thái",

                  <Select
                    disabled={!!record && !hasPermission("SYSTEM_USER", "LOCK")}
                    options={statuses}
                  />,
                )}
                {!record && (
                  <>
                    {field(
                      "password",

                      "Mật khẩu",

                      <Input.Password autoComplete="new-password" />,

                      [...required, passwordRule],
                    )}
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="confirmPassword"
                        label="Xác nhận mật khẩu"
                        dependencies={["password"]}
                        rules={[
                          ...required,

                          ({ getFieldValue }) => ({
                            validator: (_, value) =>
                              value === getFieldValue("password")
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error("Xác nhận mật khẩu không khớp."),
                                  ),
                          }),
                        ]}
                      >
                        <Input.Password autoComplete="new-password" />
                      </Form.Item>
                    </Col>
                  </>
                )}
                {field(
                  "employeeId",

                  "Nhân viên",

                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={employeeChoices

                      .filter(
                        (e) => !e.linkedUserId || e.linkedUserId === record?.id,
                      )

                      .map((e) => ({
                        value: e.id,

                        label: `${e.code} – ${e.fullName}`,
                      }))}
                    onChange={(id) => {
                      form.setFieldValue("employeeId", id || "")

                      const e = options.employees.find((item) => item.id === id)

                      form.setFieldValue("email", e?.email || "")
                    }}
                  />,

                  [],
                )}
                <Col xs={24} md={12}>
                  <Form.Item label="Mã nhân viên">
                    <Input readOnly value={employee?.code || ""} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Tổ sản xuất">
                    <Input
                      readOnly
                      value={employee?.productionTeamName || ""}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Số điện thoại">
                    <Input readOnly value={employee?.phone || ""} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ type: "email", message: "Email không hợp lệ." }]}
                  >
                    <Input readOnly={!!employee?.email} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="roleIds"
                    label="Vai trò"
                    dependencies={["status"]}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator: (_, value: string[]) =>
                          getFieldValue("status") !== "ACTIVE" || value?.length
                            ? Promise.resolve()
                            : Promise.reject(
                                new Error("Vui lòng chọn ít nhất một vai trò."),
                              ),
                      }),
                    ]}
                  >
                    <Select
                      mode="multiple"
                      showSearch
                      optionFilterProp="label"
                      options={options.roles.map((r) => ({
                        value: r.id,

                        label: r.name,

                        disabled: r.status !== "ACTIVE",
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
          </>
        ) : (
          <>
            {field(
              "code",

              kind === "roles" ? "Mã vai trò" : "Mã quyền",

              <Input readOnly={!!record} />,

              [
                ...required,

                {
                  pattern: /^[A-Z][A-Z0-9_]{1,99}$/,

                  message: "Mã viết hoa/snake_case (2–100 ký tự).",
                },
              ],
            )}
            {field("name", "Tên", <Input />)}
            {field("status", "Trạng thái", <Select options={statuses} />)}
            {kind === "roles" &&
              field("description", "Mô tả", <Input.TextArea rows={3} />, [])}
            {kind === "permissions" && (
              <>
                {field(
                  "module",

                  "Module",

                  <Select
                    options={[
                      "MASTER_DATA",

                      "PRODUCTION",

                      "WAREHOUSE",

                      "QUALITY",

                      "SYSTEM",
                    ].map((value) => ({ value, label: value }))}
                  />,
                )}
                {field(
                  "route",

                  "Route frontend",

                  <Input placeholder="/system/users" />,

                  [
                    ...required,

                    {
                      pattern: /^\/[a-zA-Z0-9/_:-]*$/,

                      message: "Route phải bắt đầu bằng /.",
                    },
                  ],
                )}
                <Col xs={24} md={12}>
                  <Form.Item
                    name="actions"
                    label="Actions"
                    rules={[
                      {
                        required: true,

                        type: "array",

                        min: 1,

                        message: "Vui lòng chọn ít nhất một action.",
                      },
                    ]}
                  >
                    <Select
                      mode="multiple"
                      options={actions.map((value) => ({
                        value,

                        label: value,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </>
            )}
            {kind === "data-permissions" && (
              <>
                {field(
                  "resource",

                  "Tài nguyên",

                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={options.permissions

                      .filter((p) => p.status === "ACTIVE")

                      .map((p) => ({
                        value: p.code,

                        label: `${p.code} – ${p.name}`,
                      }))}
                  />,
                )}
                {field(
                  "accessType",

                  "Loại truy cập",

                  <Select
                    options={["VIEW", "WRITE"].map((value) => ({
                      value,

                      label: value,
                    }))}
                  />,
                )}
                {field(
                  "scope",

                  "Phạm vi dữ liệu",

                  <Select
                    options={[
                      { value: "ALL", label: "ALL – Toàn bộ" },

                      {
                        value: "PRODUCTION_TEAM",

                        label: "PRODUCTION_TEAM – Tổ sản xuất",
                      },

                      { value: "SELF", label: "SELF – Cá nhân" },
                    ]}
                  />,
                )}
              </>
            )}
          </>
        )}
      </Row>
    </Form>
  )

  return (
    <Card bordered={false}>
      <FormHeader
        onBack={onBack}
        backLabel={`Danh sách ${labels[kind].toLowerCase()}`}
        onReset={reset}
        onSave={() => void save()}
        saving={saving}
        disabled={!editAllowed}
        {...(viewOnly
          ? {
              actions: editAllowed ? (
                <Button type="primary" onClick={onEdit}>
                  Sửa
                </Button>
              ) : null,
            }
          : {})}
      />
      <h3 style={{ marginTop: 0, marginBottom: 24 }}>
        {record ? (viewOnly ? "Chi tiết" : "Cập nhật") : "Thêm mới"}{" "}
        {labels[kind].toLowerCase()}
      </h3>
      {kind === "roles" && record ? (
        <Tabs
          items={[
            { key: "info", label: "Thông tin", children: information },

            ...(["users", "permissions", "data-permissions"] as const).map(
              (tab) => ({
                key: tab,

                label: {
                  users: "Người dùng",

                  permissions: "Quyền chức năng",

                  "data-permissions": "Quyền dữ liệu",
                }[tab],

                children: (
                  <RoleAssignments
                    tab={tab}
                    role={record as Role}
                    options={options}
                    readonly={viewOnly || !editAllowed}
                    onReload={onReload}
                  />
                ),
              }),
            ),
          ]}
        />
      ) : (
        information
      )}
      {record && (
        <div style={{ color: "#8c8c8c", marginTop: 24 }}>
          Ngày tạo: {new Date(record.createdAt).toLocaleString("vi-VN")} · Ngày
          cập nhật: {new Date(record.updatedAt).toLocaleString("vi-VN")}
        </div>
      )}
    </Card>
  )
}
