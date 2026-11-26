import StatusTag from "@/components/shared/StatusTag"
import { useEffect, useState } from "react"
import { Button, Card, Col, Empty, Progress, Result, Row, Select, Space, Typography } from "antd"
import { ReloadOutlined, ArrowRightOutlined, DashboardOutlined, ScheduleOutlined, CheckCircleOutlined, PauseCircleOutlined } from "@ant-design/icons"
import { useMasterData, refreshMasterData } from "../../master-data/store"
import { useAuth } from "../../auth/AuthContext"
import { hasAction, inScope } from "../../production/lib/access"
import { formatTime, orderActuals, orderLabels, percent, productionState, stamp, workActuals, workContext, workStatus } from "../../production/lib/model"
import { monitorStations } from "../../production/lib/monitor"
import { localDate } from "../../production/lib/execution"
import DataTable from "../../../components/shared/DataTable"
import { MENU_KEYS } from "../../../app/navigation/menuKeys"
import "./ProductionOverview.css"
const palette:Record<string,string>={DRAFT:"#a0adb8",RELEASED:"#5ba9c9",IN_PROGRESS:"#079095",COMPLETED:"#73ba85",CANCELLED:"#df9a97"}
export default function DashboardOverview({setActiveKey}:{setActiveKey:(key:string)=>void}) {
 const all=useMasterData(),{auth}=useAuth(),[now,setNow]=useState(()=>new Date()),[unit,setUnit]=useState<string>(),[days,setDays]=useState(7),[error,setError]=useState("")
 const refresh=()=>{try{refreshMasterData();setNow(new Date());setError("")}catch{setError("Không thể làm mới dữ liệu.")}}
 useEffect(()=>{const id=window.setInterval(refresh,15000);return()=>window.clearInterval(id)},[])
 const resources=["PRODUCTION_MONITOR","PRODUCTION_ORDER","PRODUCTION_ASSIGNMENT","PRODUCTION_EXECUTION"].filter(resource=>hasAction(auth,resource,"VIEW")),state=productionState(all)
 const allowedWorks=state.workOrders.filter(work=>resources.some(resource=>inScope(auth,resource,"VIEW",work,all)))
 const works=allowedWorks.filter(work=>!unit||workContext(work,all).station?.productionUnit===unit||(!work.stationId&&workContext(work,all).step?.allowedUnitIds.includes(unit)))
 const orders=state.productionOrders.filter(order=>(hasAction(auth,"PRODUCTION_ORDER","VIEW")&&inScope(auth,"PRODUCTION_ORDER","VIEW",order,all)||allowedWorks.some(work=>work.orderId===order.id))&&(!unit||works.some(work=>work.orderId===order.id)||order.sourceSnapshot?.steps.some(step=>step.allowedUnitIds.includes(unit))))
 const stations=all.productionUnits.filter(row=>row.status==="Hoạt động"&&(!unit||row.id===unit)).flatMap(row=>monitorStations(row.id,all,auth,now))
 const running=works.filter(work=>workStatus(work,all)==="IN_PROGRESS").length,paused=works.filter(work=>workStatus(work,all)==="PAUSED").length,completed=works.filter(work=>workStatus(work,all)==="COMPLETED").length
 const events=state.productionExecutions.filter(event=>works.some(work=>work.id===event.workOrderId))
 const history=Array.from({length:days},(_,index)=>{const date=new Date(now);date.setDate(date.getDate()-days+1+index);const key=localDate(date);return {key,label:`${date.getDate()}/${date.getMonth()+1}`,started:events.filter(event=>event.kind==="START"&&localDate(new Date(event.at))===key).length,completed:events.filter(event=>event.kind==="COMPLETE"&&localDate(new Date(event.at))===key).length}})
 const max=Math.max(1,...history.flatMap(item=>[item.started,item.completed]))
 const statuses=Object.entries(orderLabels).map(([key,label])=>({key,label,count:orders.filter(order=>order.status===key).length}));let offset=0
 const gradient=statuses.map(item=>{const start=offset;offset+=orders.length?item.count/orders.length*100:0;return `${palette[item.key]} ${start}% ${offset}%`}).join(",")
 const activeOrders=orders.filter(order=>!["COMPLETED","CANCELLED"].includes(order.status)).sort((a,b)=>stamp(a.end)-stamp(b.end)).slice(0,6)
 const operations=[...new Set(works.map(work=>workContext(work,all).step?.operationId).filter(Boolean))].map(id=>{const subset=works.filter(work=>workContext(work,all).step?.operationId===id);return {id,name:workContext(subset[0],all).step?.name,total:subset.length,done:subset.filter(work=>workStatus(work,all)==="COMPLETED").length}}).sort((a,b)=>b.total-a.total).slice(0,5)
 if(!resources.length)return <Result status="403" title="Bạn không có quyền xem dữ liệu sản xuất"/>
 return <div className="production-overview">
  <header className="production-overview-heading"><div><span className="production-overview-eyebrow">KHÔNG GIAN ĐIỀU HÀNH · MES</span><h1>Tổng quan sản xuất</h1><p>Theo dõi kế hoạch, tiến độ và hoạt động sản xuất.</p></div><Space wrap><Select aria-label="Đơn vị sản xuất" allowClear placeholder="Tất cả đơn vị" value={unit} style={{minWidth:180}} onChange={setUnit} options={all.productionUnits.filter(row=>row.status==="Hoạt động"&&(auth?.dataScopes["PRODUCTION_MONITOR:VIEW"]==="ALL"||allowedWorks.some(work=>workContext(work,all).station?.productionUnit===row.id||workContext(work,all).step?.allowedUnitIds.includes(row.id)))).map(row=>({value:row.id,label:String(row.name)}))}/><Button icon={<ReloadOutlined/>} onClick={refresh}>Làm mới</Button></Space></header>
  <div className="production-overview-live"><span/> Cập nhật lúc {now.toLocaleTimeString("vi-VN")} · {now.toLocaleDateString("vi-VN")}{error&&<Typography.Text type="danger">{error}</Typography.Text>}</div>
  <Row gutter={[16,16]}>{[
   {label:"Lệnh sản xuất",value:orders.length,sub:`${orders.filter(order=>order.status==="RELEASED").length} lệnh đã phát hành`,icon:<ScheduleOutlined/>,color:"#079095"},
   {label:"WO đang thực hiện",value:running,sub:`${works.length} lệnh làm việc trong phạm vi`,icon:<DashboardOutlined/>,color:"#3b8ea5"},
   {label:"WO đã hoàn thành",value:completed,sub:`${orders.filter(order=>order.status==="COMPLETED").length} MO hoàn thành`,icon:<CheckCircleOutlined/>,color:"#529d6a"},
   {label:"WO tạm dừng",value:paused,sub:hasAction(auth,"PRODUCTION_MONITOR","VIEW")?`${stations.filter(row=>row.problems).length} trạm cần chú ý`:"Theo trạng thái thực thi",icon:<PauseCircleOutlined/>,color:"#d48836"},
  ].map(item=><Col xs={12} xl={6} key={item.label}><Card className="production-kpi"><div className="production-kpi-top"><span>{item.label}</span><span style={{color:item.color,background:`${item.color}12`}}>{item.icon}</span></div><strong>{item.value}</strong><small>{item.sub}</small></Card></Col>)}</Row>
  <Row gutter={[16,16]} style={{marginTop:16}}>
   <Col xs={24} lg={16}><Card title="Nhịp độ thực hiện công việc" extra={<Select aria-label="Khoảng thời gian biểu đồ" value={days} onChange={setDays} options={[7,14,30].map(value=>({value,label:`${value} ngày gần nhất`}))}/>}>
    <div className="production-chart-legend"><span><i style={{background:"#b9dedd"}}/>WO bắt đầu</span><span><i style={{background:"#079095"}}/>WO hoàn thành</span></div>
    {events.length?<div className="production-chart-scroll"><svg viewBox={`0 0 ${Math.max(640,days*32)} 235`} role="img" aria-label={`Số WO bắt đầu và hoàn thành theo ngày trong ${days} ngày gần nhất`} className="production-bar-chart">
     {[0,1,2,3,4].map(i=><g key={i}><line x1="30" y1={190-i*40} x2={Math.max(640,days*32)-8} y2={190-i*40} stroke="#edf2f3"/><text x="22" y={194-i*40} textAnchor="end" fill="#8b9fa3" fontSize="10">{Math.ceil(max*i/4)}</text></g>)}
     {history.map((item,i)=>{const w=(Math.max(640,days*32)-45)/days,x=35+i*w;return <g key={item.key}><rect x={x+w*.16} y={190-item.started/max*160} width={w*.26} height={item.started/max*160} rx="3" fill="#b9dedd"><title>{item.label}: {item.started} WO bắt đầu</title></rect><rect x={x+w*.48} y={190-item.completed/max*160} width={w*.26} height={item.completed/max*160} rx="3" fill="#079095"><title>{item.label}: {item.completed} WO hoàn thành</title></rect><text x={x+w*.45} y="214" textAnchor="middle" fontSize="10" fill="#7d9298">{item.label}</text></g>})}
    </svg></div>:<Empty description="Chưa có nhật ký thực thi" image={Empty.PRESENTED_IMAGE_SIMPLE}/>}
   </Card></Col>
   <Col xs={24} lg={8}><Card title="Phân bổ lệnh sản xuất" style={{height:"100%"}}><div className="production-donut" role="img" aria-label={statuses.map(item=>`${item.label}: ${item.count}`).join(", ")} style={{background:orders.length?`conic-gradient(${gradient})`:"#edf2f3"}}><div><strong>{orders.length}</strong><span>Lệnh sản xuất</span></div></div><div className="production-status-legend">{statuses.map(item=><div key={item.key}><span><i style={{background:palette[item.key]}}/>{item.label}</span><strong>{item.count}</strong></div>)}</div></Card></Col>
  </Row>
  <Row gutter={[16,16]} style={{marginTop:16}}><Col xs={24} lg={16}><Card title="Kế hoạch đang theo dõi" extra={hasAction(auth,"PRODUCTION_ORDER","VIEW")?<Button type="link" onClick={()=>setActiveKey(MENU_KEYS.PRODUCTION_ORDERS)}>Lệnh sản xuất <ArrowRightOutlined/></Button>:null}><DataTable rowKey="id" dataSource={activeOrders} pagination={false} scroll={{x:650}} columns={[
   {title:"Lệnh sản xuất",width:125,render:(_,order)=><><strong>{order.code}</strong><div><StatusTag color={order.status==="IN_PROGRESS"?"cyan":"default"}>{orderLabels[order.status]}</StatusTag></div></>},
   {title:"Sản phẩm",render:(_,order)=>order.sourceSnapshot?.product.name||String(all.products.find(row=>row.id===order.productId)?.name||"—")},
   {title:"Sản lượng bước cuối",width:170,render:(_,order)=>{const actual=orderActuals(order,all);return <><span>{actual.quantity} / {order.quantity} {order.sourceSnapshot?.product.unit}</span><Progress size="small" strokeColor="#079095" percent={Number(percent(actual.quantity,order.quantity).toFixed(1))}/></>}},
   {title:"Kết thúc kế hoạch",width:145,render:(_,order)=><Typography.Text type={stamp(order.end)<now.getTime()?"danger":undefined}>{formatTime(order.end)}</Typography.Text>},
  ]}/></Card></Col><Col xs={24} lg={8}><Card title="Hoàn thành theo công đoạn" style={{height:"100%"}}>{operations.length?operations.map(op=><div className="production-operation" key={op.id}><div><span>{op.name}</span><strong>{op.done}/{op.total} WO</strong></div><Progress strokeColor="#079095" percent={Math.round(op.done/op.total*100)} size="small"/></div>):<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có công đoạn"/>}</Card></Col></Row>
  <div className="production-shortcuts">{[{resource:"PRODUCTION_ORDER",key:MENU_KEYS.PRODUCTION_ORDERS,label:"Lệnh sản xuất"},{resource:"PRODUCTION_ASSIGNMENT",key:MENU_KEYS.PRODUCTION_ASSIGNMENTS,label:"Phân công sản xuất"},{resource:"PRODUCTION_EXECUTION",key:MENU_KEYS.PRODUCTION,label:"Thực thi sản xuất"},{resource:"PRODUCTION_MONITOR",key:MENU_KEYS.PRODUCTION_PROGRESS,label:"Giám sát vận hành"}].filter(item=>hasAction(auth,item.resource,"VIEW")).map(item=><Button key={item.key} onClick={()=>setActiveKey(item.key)}>{item.label}<ArrowRightOutlined/></Button>)}</div>
 </div>
}
