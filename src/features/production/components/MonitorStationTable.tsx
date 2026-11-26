import StatusTag from "@/components/shared/StatusTag"
import { Button, Progress, Space, Tag, Typography } from "antd"
import DataTable from "../../../components/shared/DataTable"
import type { Catalog } from "../../process-bom/lib/model"
import { text } from "../../process-bom/lib/model"
import { formatTime, percent, stamp, workActuals, workContext } from "../lib/model"
import { deadlineLabel, monitorColors, monitorLabels, type MonitoredStation } from "../lib/monitor"
import "./MonitorStationTable.css"
export default function MonitorStationTable({rows,all,now,onOpen}:{rows:MonitoredStation[];all:Catalog;now:Date;onOpen:(station:string,work?:string)=>void}) {
 const color=(row:MonitoredStation)=>row.status==="PAUSED"?"#d46b08":row.flags.includes("OVERDUE")||row.problems?"#cf1322":row.status==="IN_PROGRESS"?"#389e0d":row.status==="READY"?"#08979c":"#8c8c8c"
 return <DataTable<MonitoredStation> className="monitor-station-table" rowKey={row=>row.station.id} dataSource={rows} size="small" scroll={{ x: 1184 }} pagination={{defaultPageSize:20,showTotal:total=>`${total} trạm`}}
 columns={[
 {title:"Trạm sản xuất",width: 160,fixed:"left",render:(_,row)=><><Button type="link" style={{padding:0,fontWeight:600}} onClick={()=>onOpen(row.station.id)}>{text(row.station.code)}</Button><div>{text(row.station.name)}</div></>},
 {title:"Trạng thái vận hành",width: 155,render:(_,row)=><Space orientation="vertical" size={4}><StatusTag color={row.status==="IN_PROGRESS"?"green":monitorColors[row.status]}>{monitorLabels[row.status]}</StatusTag>{row.flags.includes("OVERDUE")&&row.status!=="OVERDUE"&&<StatusTag color="red">Quá hạn</StatusTag>}{row.problems&&row.current.error&&<Typography.Text type="danger" style={{fontSize:12}}>Thiếu / xung đột nhân sự</Typography.Text>}</Space>},
 {title:"Công việc / Sản phẩm",width: 210,render:(_,row)=>{if(!row.primary)return <Typography.Text type="secondary">Không có công việc</Typography.Text>;const c=workContext(row.primary,all);return <><Space><Button type="link" style={{padding:0}} onClick={()=>onOpen(row.station.id,row.primary!.id)}>{row.primary.code}</Button><Typography.Text type="secondary">{c.order?.code}</Typography.Text></Space><div style={{fontWeight:500}}>{c.source?.product.name}</div><Typography.Text type="secondary">{c.step?.order} · {c.step?.name}</Typography.Text></>}},
 {title:"Nhân viên / Ca",width: 143,render:(_,row)=><><div>{row.current.assignment?text(row.current.employee?.name):<Typography.Text type={row.problems?"danger":"secondary"}>Chưa phân công</Typography.Text>}</div><Typography.Text type="secondary">{row.current.slot?`${row.current.slot.shift.name} · ${row.current.slot.shift.start}–${row.current.slot.shift.end}`:"Ngoài ca"}</Typography.Text></>},
 {title:"Sản lượng / Tiến độ",width: 147,render:(_,row)=>{if(!row.primary)return "—";const c=workContext(row.primary,all),actual=workActuals(row.primary.id,all),value=percent(actual.quantity,c.order?.quantity||0);return <><div><strong>{actual.quantity.toLocaleString("vi-VN")}</strong><Typography.Text type="secondary"> / {c.order?.quantity.toLocaleString("vi-VN")} {c.source?.product.unit}</Typography.Text></div><Progress size="small" percent={Number(value.toFixed(1))} strokeColor={color(row)}/></>}},
 {title:"Kế hoạch / Thời hạn",width: 176,render:(_,row)=>{if(!row.primary)return "—";const step=workContext(row.primary,all).step;return <><div>{formatTime(step?.start)}</div><div>→ {formatTime(step?.end)}</div><Typography.Text style={{fontSize:12}} type={row.flags.includes("OVERDUE")?"danger":"secondary"}>{deadlineLabel(step?.end,now)}</Typography.Text></>}},
 {title:"Cảnh báo / Dừng máy",width: 193,render:(_,row)=>row.pause?<><Tag color="orange">{row.pause.reasonName}</Tag><div>Đã dừng {Math.max(0,Math.floor((now.getTime()-stamp(row.pause.at))/60000))} phút</div><Typography.Text type="secondary">{row.pause.machineName||""}</Typography.Text></>:row.problems?<Typography.Text type="danger">{row.current.error || "Công việc chưa hoàn thành đúng hạn"}</Typography.Text>:row.primary?<Typography.Text type="secondary">{row.upcoming.length?`${row.upcoming.length} công việc kế tiếp`:"—"}</Typography.Text>:"—"},
]}/>
}
