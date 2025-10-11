// 名称: 天气请求诊断脚本
// 描述: 检查是否拦截到天气请求

console.log("🔍 天气请求诊断启动");

if (typeof $request !== "undefined") {
    console.log("✅ 成功拦截到请求");
    console.log("📡 请求URL:", $request.url);
    console.log("🔧 请求方法:", $request.method);
    console.log("📋 请求头:", JSON.stringify($request.headers));
    
    $notification.post(
        "✅ 请求拦截成功", 
        $request.method + " " + $request.url,
        "查看Loon日志获取详细信息"
    );
    
    // 直接完成请求，不干扰
    $done({});
} else {
    console.log("❌ 未拦截到任何请求");
    $notification.post(
        "❌ 诊断结果", 
        "未拦截到天气请求",
        "请检查MitM配置和hostname"
    );
    $done();
}