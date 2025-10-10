// 名称: 唯一测试脚本-WeatherKit
// 描述: 带有唯一标识的测试脚本
// 作者: Assistant

const SCRIPT_ID = "UNIQUE_WEATHERKIT_TEST_001";

console.log(`🆔 ${SCRIPT_ID} - 脚本启动`);

if (typeof $request !== "undefined") {
    console.log(`🎉 ${SCRIPT_ID} - 成功拦截到请求！`);
    console.log(`📡 ${SCRIPT_ID} - URL:`, $request.url);
    
    $notification.post(
        `🎉 ${SCRIPT_ID} 拦截成功`, 
        "这个脚本确实在执行",
        `URL: ${$request.url.split('?')[0]}\n时间: ${new Date().toLocaleTimeString()}`
    );
    
} else {
    console.log(`❌ ${SCRIPT_ID} - 未检测到$request对象`);
    
    $notification.post(
        `❌ ${SCRIPT_ID} 测试结果`, 
        "脚本以定时任务模式运行",
        "说明拦截可能被其他脚本处理了"
    );
}

$done();
