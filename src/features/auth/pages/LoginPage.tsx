import FactoryLogo from "../../../assets/factory-logo.png"
import { useState } from "react"
import { Alert, Form, Input, Checkbox, Button } from "antd"
import { Factory, Workflow, ChartNoAxesCombined, ArrowRight, ShieldCheck, UserRound, LockKeyhole, Settings2 } from "lucide-react"
import { useAuth } from "../AuthContext"
import type { LoginRequest } from "../../system/types"
import "./LoginPage.css"

export default function Login() {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false), [error, setError] = useState("")
  const handleFinish = async (values: LoginRequest) => {
    if (loading) return
    setLoading(true); setError("")
    try { await login(values) }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể đăng nhập.") }
    finally { setLoading(false) }
  }
  return <main className="factory-login">
    <section className="factory-login-hero" aria-label="Nhà máy cơ khí">
      <div className="factory-brand"><span className="factory-brand-icon"><img src={FactoryLogo} alt="Logo nhà máy cơ khí"/></span><div>NHÀ MÁY CƠ KHÍ<small>MANUFACTURING EXECUTION SYSTEM</small></div></div>
      <div className="factory-hero-content"><span className="factory-eyebrow"><span/> KẾT NỐI VẬN HÀNH · TỐI ƯU SẢN XUẤT</span>
        <h1>Mỗi công đoạn.<br/>Một dòng chảy <em>thông suốt.</em></h1>
        <p>Kết nối kế hoạch, con người và thiết bị trên một nền tảng quản lý sản xuất tập trung.</p>
        <div className="factory-visual" aria-hidden="true">
          <div className="factory-visual-top"><span><Settings2 size={15}/> KHÔNG GIAN ĐIỀU HÀNH</span><span className="factory-live-dot"/></div>
          <svg viewBox="0 0 560 205" fill="none" className="factory-scene">
            <defs><linearGradient id="factory-building" x1="100" y1="40" x2="400" y2="200" gradientUnits="userSpaceOnUse"><stop stopColor="#35b7b5" stopOpacity=".5"/><stop offset="1" stopColor="#079095" stopOpacity=".12"/></linearGradient></defs>
            <path d="M30 178H530M60 193H500" stroke="#75d8d1" strokeOpacity=".2"/>
            <path d="M94 175V88L168 55V88L242 55V88L316 55V175H94Z" fill="url(#factory-building)" stroke="#70ddd5" strokeWidth="1.5"/>
            <path d="M118 116H145V137H118ZM169 116H196V137H169ZM220 116H247V137H220Z" fill="#83eee1" fillOpacity=".3" stroke="#73d9d2"/>
            <path d="M265 175V118H295V175M108 98H302" stroke="#70ddd5" strokeOpacity=".6"/>
            <path d="M117 76V35H133V69M273 71V21H291V63" stroke="#70ddd5" strokeWidth="1.5"/>
            <path d="M321 175H466V115H321M344 115V84H389V115M397 115V97H438V115" fill="#179e9f" fillOpacity=".25" stroke="#70ddd5"/>
            <path d="M350 143H438M350 155H423" stroke="#70ddd5" strokeOpacity=".6"/>
            <circle cx="410" cy="59" r="27" stroke="#70ddd5" strokeOpacity=".3" strokeDasharray="4 5"/><path d="M399 59L407 67L422 51" stroke="#8ef1d7" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M62 153H87M477 153H505" stroke="#70ddd5" strokeDasharray="3 4"/><circle cx="62" cy="153" r="4" fill="#8ef1d7"/><circle cx="505" cy="153" r="4" fill="#8ef1d7"/>
          </svg>
          <div className="factory-flow"><span><Workflow size={17}/> Kế hoạch</span><ArrowRight size={14}/><span><Factory size={17}/> Thực thi</span><ArrowRight size={14}/><span><ChartNoAxesCombined size={17}/> Giám sát</span></div>
        </div>
      </div>
      <footer className="factory-hero-footer"><span>MES · SẢN XUẤT THÔNG MINH</span><span>Từ kế hoạch đến vận hành</span></footer>
    </section>
    <section className="factory-login-panel" aria-labelledby="factory-login-title">
      <div className="factory-form-wrap"><span className="factory-form-mark"><img src={FactoryLogo} alt="Logo nhà máy cơ khí"/></span><span className="factory-form-eyebrow">CHÀO MỪNG TRỞ LẠI</span>
        <h2 id="factory-login-title">Hệ thống quản lý sản xuất<br/><span>cho nhà máy cơ khí</span></h2>
        <p className="factory-form-description">Đăng nhập để truy cập không gian làm việc của bạn.</p>
        {error && <Alert type="error" showIcon title={error} style={{marginBottom:20}}/>}
        <Form layout="vertical" name="factory-login" onFinish={handleFinish} disabled={loading} requiredMark={false}>
          <Form.Item label="Tên đăng nhập" name="username" rules={[{required:true,message:"Vui lòng nhập tên đăng nhập!"}]}><Input autoComplete="username" size="large" prefix={<UserRound size={17}/>} placeholder="Nhập tên đăng nhập"/></Form.Item>
          <Form.Item label="Mật khẩu" name="password" rules={[{required:true,message:"Vui lòng nhập mật khẩu!"}]}><Input.Password autoComplete="current-password" size="large" prefix={<LockKeyhole size={17}/>} placeholder="Nhập mật khẩu"/></Form.Item>
          <div className="factory-form-options"><Form.Item name="remember" valuePropName="checked" noStyle><Checkbox>Lưu đăng nhập</Checkbox></Form.Item></div>
          <Form.Item style={{marginBottom:20}}><Button type="primary" htmlType="submit" loading={loading} block size="large" className="factory-submit">Đăng nhập <ArrowRight size={18}/></Button></Form.Item>
        </Form>
        <div className="factory-password-help">Quên mật khẩu? <span>Liên hệ quản trị viên</span></div>
        <div className="factory-security"><ShieldCheck size={17}/><span>Kết nối an toàn đến hệ thống nội bộ</span></div>
      </div>
      <footer className="factory-panel-footer">HỆ THỐNG ĐIỀU HÀNH SẢN XUẤT · MES</footer>
    </section>
  </main>
}
