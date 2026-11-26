import { useMemo, useState } from "react"

import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Row,
  Space,
  Tree,
} from "antd"

import type { RecordData } from "../../master-data/config"

import {
  bomLines,
  buildBomTree,
  text,
  type BomNode,
  type Catalog,
} from "../lib/model"

interface TreeItem {
  key: string
  title: string
  children?: TreeItem[]
}

export default function BomTree({
  record,
  all,
  quantity,
}: {
  record: RecordData
  all: Catalog
  quantity?: number
}) {
  const root = useMemo(
    () => buildBomTree(record, all, quantity),
    [record, all, quantity],
  )

  const [selected, setSelected] = useState(root.key),
    [expanded, setExpanded] = useState<string[]>([root.key]),
    [search, setSearch] = useState("")

  const flat = (node: BomNode): BomNode[] => [
    node,
    ...(node.children || []).flatMap(flat),
  ]

  const nodes = flat(root),
    node = nodes.find((item) => item.key === selected) || root,
    product = all.products.find((item) => item.id === node.product)

  const tree = (item: BomNode): TreeItem => ({
    key: item.key,
    title: `${item.title} — ${item.quantity.toLocaleString("vi-VN", { maximumFractionDigits: 6 })} ${item.unit}`,
    children: item.children?.map(tree),
  })

  const totals = new Map<string, number>()

  for (const line of bomLines(record)) {
    const unit = text(
      all.products.find((product) => product.id === line.material)?.unit,
    )
    totals.set(
      unit,
      (totals.get(unit) || 0) +
        ((Number(line.quantity) * Number(quantity ?? record.quantity)) /
          Number(record.quantity || 1)) *
          (1 + Number(line.waste || 0) / 100),
    )
  }

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small" title="Số loại thành phần">
            {bomLines(record).length}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="Định mức gồm hao hụt theo đơn vị">
            {[...totals]
              .map(
                ([unit, value]) =>
                  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 6 })} ${unit}`,
              )
              .join(" · ") || "—"}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="Hao hụt bình quân">
            {(
              bomLines(record).reduce(
                (sum, line) => sum + Number(line.waste || 0),
                0,
              ) / Math.max(1, bomLines(record).length)
            ).toFixed(2)}{" "}
            %
          </Card>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} lg={15}>
          <Card
            title="Cấu trúc cây định mức BOM"
            size="small"
            extra={
              <Space>
                <Button
                  size="small"
                  onClick={() => setExpanded(nodes.map((node) => node.key))}
                >
                  Mở rộng tất cả
                </Button>
                <Button size="small" onClick={() => setExpanded([])}>
                  Thu gọn tất cả
                </Button>
              </Space>
            }
          >
            <Input.Search
              allowClear
              placeholder="Tìm thành phần trong cây…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                if (event.target.value)
                  setExpanded(nodes.map((node) => node.key))
              }}
              style={{ marginBottom: 12 }}
            />
            {root.children?.length ? (
              <Tree
                showLine
                blockNode
                treeData={[tree(root)]}
                expandedKeys={expanded}
                onExpand={(keys) => setExpanded(keys.map(String))}
                selectedKeys={[node.key]}
                onSelect={(keys) => keys[0] && setSelected(String(keys[0]))}
                filterTreeNode={(item) =>
                  !!search &&
                  text(item.title)
                    .toLocaleLowerCase("vi")
                    .includes(search.toLocaleLowerCase("vi"))
                }
              />
            ) : (
              <Empty description="Chưa có thành phần BOM" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title="Thông tin phần tử đang chọn" size="small">
            <Descriptions
              bordered
              column={1}
              size="small"
              items={[
                {
                  key: "code",
                  label: "Mã sản phẩm",
                  children: text(product?.code),
                },
                {
                  key: "name",
                  label: "Tên sản phẩm",
                  children: text(product?.name),
                },
                {
                  key: "kind",
                  label: "Loại",
                  children: text(product?.category),
                },
                {
                  key: "quantity",
                  label: "Nhu cầu gồm hao hụt",
                  children: node.quantity.toLocaleString("vi-VN", {
                    maximumFractionDigits: 6,
                  }),
                },
                { key: "unit", label: "Đơn vị tính", children: node.unit },
                { key: "waste", label: "Hao hụt", children: `${node.waste} %` },
                {
                  key: "bom",
                  label: "BOM",
                  children:
                    text(all.boms.find((bom) => bom.id === node.bom)?.code) ||
                    "—",
                },
                { key: "note", label: "Ghi chú", children: node.note || "—" },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
