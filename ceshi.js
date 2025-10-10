// 名称: 苹果天气拦截详细诊断
// 描述: 详细诊断拦截问题，记录所有相关信息
// 作者: Assistant

console.log("🔍 开始详细诊断拦截问题");

if (typeof $request !== "undefined") {
    console.log("✅ 检测到$request对象");
    console.log("📡 完整URL:", $request.url);
    console.log("🏷️ User-Agent:", $request.headers["User-Agent"]);
    
    // 保存请求信息用于分析
    const requestInfo = {
        url: $request.url,
        method: $request.method,
        headers: $request.headers,
        timestamp: new Date().getTime()
    };
    
    $persistentStore.write(JSON.stringify(requestInfo), "last_request_info");
    
    $notification.post(
        "🔍 拦截诊断-有请求",
        "成功拦截到网络请求",
        `域名: ${$request.url.split('/')[2]}\n点击查看详情`
    );
    
} else {
    console.log("❌ 未检测到$request对象");
    
    // 检查之前是否有成功记录
    const lastRequest = $persistentStore.read("last_request_info");
    const lastGPS = $persistentStore.read("test_gps_location");
    
    let body = "";
    
    if (lastRequest) {
        try {
            const request = JSON.parse(lastRequest);
            const time = new Date(request.timestamp).toLocaleTimeString();
            body += `上次拦截: ${time}\n`;
            body += `域名: ${request.url.split('/')[2]}\n`;
        } catch (e) {
            body += "上次请求数据解析失败\n";
        }
    } else {
        body += "从未成功拦截过请求\n";
    }
    
    if (lastGPS) {
        body += "\n✅ 有GPS定位数据";
    } else {
        body += "\n❌ 无GPS定位数据";
    }
    
    // 检查系统状态
    body += "\n\n建议检查:";
    body += "\n1. Loon证书信任设置";
    body += "\n2. MITM主机名配置"; 
    body += "\n3. 天气App定位权限";
    
    $notification.post(
        "🔍 拦截诊断结果",
        "当前状态分析",
        body
    );
}

$done();
