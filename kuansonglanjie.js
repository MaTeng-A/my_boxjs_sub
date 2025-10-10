// 名称: 基础功能测试
// 描述: 测试最基本的拦截功能
// 作者: Assistant

console.log("🔧 基础功能测试开始");

if (typeof $request !== "undefined") {
    console.log("🎉 成功拦截到请求！");
    console.log("📡 URL:", $request.url);
    
    $notification.post(
        "🎉 拦截成功", 
        "检测到$request对象",
        `URL: ${$request.url.split('?')[0]}`
    );
    
} else {
    console.log("❌ 未检测到$request对象");
    
    $notification.post(
        "❌ 测试结果", 
        "未检测到拦截",
        "脚本以定时任务模式运行\n可能拦截未生效"
    );
}

$done();
