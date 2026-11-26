import { Table } from "antd"
import type { TableProps } from "antd"

/** Common list presentation; columns, row identity and data remain feature-owned. */
export default function DataTable<RecordType extends object>({ pagination, locale, className, ...props }: TableProps<RecordType>) {
  return <Table<RecordType> size="middle" tableLayout="fixed" className={className}
    locale={{ emptyText: "Không có dữ liệu", ...locale }}
    pagination={pagination === false ? false : { defaultPageSize: 10, showSizeChanger: true, ...pagination }} {...props} />
}
