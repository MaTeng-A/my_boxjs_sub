// 名称: 自动触发GPS更新（Loon专用版）
// 描述: 自动打开天气App触发GPS拦截，然后关闭
// 作者: Assistant
// 版本: 3.4 - Loon优化版

console.log("🔄 自动触发GPS更新启动");

function main() {
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 120) {
        console.log("🔄 自动触发天气App获取GPS");
        autoTriggerWeatherApp();
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        $done();
    }
}

function autoTriggerWeatherApp() {
    console.log("📱 自动打开天气App...");
    
    const startTime = Date.now();
    $persistentStore.write(startTime.toString(), "gps_update_start_time");
    
    // 先清除旧数据，确保获取新数据
    $persistentStore.write("", "accurate_gps_location");
    $persistentStore.write("", "location_timestamp");
    
    // 打开天气App
    $app.openURL("weather://");
    
    // 增加等待时间到12秒
    setTimeout(() => {
        console.log("✅ 等待完成，关闭天气App");
        
        // 强制关闭天气App
        $app.openURL("loon://");
        
        // 增加检查延迟到3秒
        setTimeout(() => {
            checkGPSUpdateResult(startTime);
        }, 3000);
        
    }, 12000);
}

function checkGPSUpdateResult(startTime) {
    const gpsData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    console.log(`🔍 检查GPS更新结果`);
    console.log(`- 开始时间: ${startTime}`);
    console.log(`- 获取时间戳: ${newTimestamp}`);
    console.log(`- GPS数据: ${gpsData ? "存在" : "不存在"}`);
    
    if (gpsData && newTimestamp) {
        try {
            const location = JSON.parse(gpsData);
            const updateTime = parseInt(newTimestamp);
            
            // 放宽时间验证条件：允许在开始时间前后30秒内的数据
            if (Math.abs(updateTime - startTime) < 30000) {
                console.log(`🎉 GPS数据已更新`);
                console.log(`📍 坐标: ${location.latitude}, ${location.longitude}`);
                console.log(`📡 来源: ${location.source}`);
            } else {
                console.log(`⚠️ 时间戳验证失败`);
                console.log(`- 开始时间: ${startTime}`);
                console.log(`- 更新时间: ${updateTime}`);
                console.log(`- 时间差: ${updateTime - startTime}ms`);
            }
        } catch (e) {
            console.log("❌ GPS数据解析失败:", e);
        }
    } else {
        console.log("❌ 未获取到GPS数据");
    }
    $done();
}

main();