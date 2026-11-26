import { useState } from "react"
import { Button, Input, Select, Space } from "antd"
import DataTable from "../../components/shared/DataTable"
import { navigate } from "../auth/AuthContext"
import { useMasterData } from "./store"
import { ids, statusLabel } from "./rules"

export default function ProductionUnitMembers({
  unitId,
  entity,
}: {
  unitId: string
  entity: "employees" | "stations"
}) {
  const all = useMasterData()
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState<string>()
  const [filters, setFilters] = useState({ keyword: "", status: "" })
  const rows = all[entity].filter(
    (row) =>
      (entity === "employees" ? row.productionUnitId : row.productionUnit) ===
      unitId,
  )
  const filtered = rows.filter(
    (row) =>
      (!filters.status || row.status === filters.status) &&
      `${row.code} ${row.name}`
        .toLocaleLowerCase("vi")
        .includes(filters.keyword.trim().toLocaleLowerCase("vi")),
  )
  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="Tìm mã hoặc tên"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onPressEnter={() => setFilters({ keyword, status: status || "" })}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          value={status}
          style={{ width: 180 }}
          onChange={setStatus}
          options={["Hoạt động", "Không hoạt động"].map((value) => ({
            value,
            label: statusLabel(entity, value),
          }))}
        />
        <Button
          onClick={() => {
            setKeyword("")
            setStatus(undefined)
            setFilters({ keyword: "", status: "" })
          }}
        >
          Đặt lại
        </Button>
        <Button
          type="primary"
          onClick={() => setFilters({ keyword, status: status || "" })}
        >
          Tìm kiếm
        </Button>
        <span>
          Tổng số: {rows.length} {entity === "employees" ? "nhân viên" : "trạm"}
        </span>
      </Space>
      <DataTable
        rowKey="id"
        dataSource={filtered}
        columns={[
          {
            title: "Mã",
            dataIndex: "code",
            render: (code, row) => (
              <Button
                type="link"
                onClick={() =>
                  navigate(
                    `/workspace/${
                      entity === "employees"
                        ? "master-employees"
                        : "master-stations"
                    }?record=${encodeURIComponent(row.id)}`,
                  )
                }
              >
                {String(code)}
              </Button>
            ),
          },
          { title: "Tên", dataIndex: "name" },
          ...(entity === "stations"
            ? [
                {
                  title: "Số lượng máy",
                  render: (_: unknown, row: typeof rows[number]) =>
                    ids(row.machineIds).length,
                },
              ]
            : [{ title: "Chức danh", dataIndex: "jobTitle" }]),
          {
            title: "Trạng thái",
            render: (_, row) => statusLabel(entity, row.status),
          },
        ]}
      />
    </>
  )
}
