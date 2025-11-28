// 名称: 自动触发GPS更新（兼容拦截脚本版）
// 描述: 自动打开天气App触发GPS拦截，然后关闭
// 作者: Assistant
// 版本: 3.3 - 无通知版+API兼容

console.log("🔄 自动触发GPS更新启动");

function main() {
    // 读取GPS时间戳
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 120) { // 超过2小时需要更新
        console.log("🔄 自动触发天气App获取GPS");
        autoTriggerWeatherApp();
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        $done();
    }
}

function openURL(url) {
    // 兼容不同环境的URL打开函数
    if (typeof $tool !== 'undefined' && $tool.openURL) {
        $tool.openURL(url); // Surge
    } else if (typeof $task !== 'undefined' && $task.openURL) {
        $task.openURL(url); // Quantumult X
    } else if (typeof $loon !== 'undefined' && $loon.openURL) {
        $loon.openURL(url); // Loon
    } else if (typeof $httpClient !== 'undefined') {
        // 如果都没有，尝试使用通用的方法
        $notification.post("URL", "请手动打开", url);
    } else {
        console.log(`📱 请手动打开URL: ${url}`);
    }
}

function autoTriggerWeatherApp() {
    console.log("📱 自动打开天气App...");
    
    // 记录开始时间用于验证
    const startTime = Date.now();
    $persistentStore.write(startTime.toString(), "gps_update_start_time");
    
    // 打开天气App触发GPS拦截
    openURL("weather://");
    
    // 等待8秒让天气App完成定位
    setTimeout(() => {
        console.log("✅ 等待完成，返回Loon");
        // 返回Loon
        openURL("loon://");
        
        // 检查是否成功获取了新坐标
        setTimeout(() => {
            checkGPSUpdateResult(startTime);
        }, 2000);
        
    }, 8000);
}

function checkGPSUpdateResult(startTime) {
    // 读取GPS数据 - 使用拦截脚本相同的键名
    const gpsData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    console.log(`🔍 检查GPS更新结果 - 时间戳: ${newTimestamp}`);
    
    if (gpsData && newTimestamp) {
        try {
            const location = JSON.parse(gpsData);
            const updateTime = parseInt(newTimestamp);
            
            // 验证时间戳是否在开始时间之后（确保是新数据）
            if (updateTime >= startTime) {
                console.log(`🎉 GPS数据已更新 - 坐标: ${location.latitude}, ${location.longitude}`);
                console.log(`📡 数据来源: ${location.source}`);
            } else {
                console.log("⚠️ GPS数据未更新（时间戳验证失败）");
            }
        } catch (e) {
            console.log("❌ GPS数据解析失败:", e);
        }
    } else {
        console.log("❌ GPS数据未更新");
        console.log(`详细检查:`);
        console.log(`- location_timestamp: ${newTimestamp}`);
        console.log(`- accurate_gps_location: ${gpsData ? "存在" : "不存在"}`);
    }
    $done();
}

main();