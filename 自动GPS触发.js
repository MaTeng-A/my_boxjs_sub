// 名称: 自动GPS触发（Loon兼容版）
// 描述: 自动打开天气App触发GPS拦截
// 作者: Assistant
// 版本: 4.0 - Loon兼容版

console.log("🔄 自动触发GPS更新启动");

function main() {
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 120) {
        console.log("🔄 GPS数据过期，自动触发更新");
        autoTriggerWeatherApp();
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        $done();
    }
}

function autoTriggerWeatherApp() {
    console.log("📱 准备打开天气App...");
    
    const startTime = Date.now();
    $persistentStore.write(startTime.toString(), "gps_update_start_time");
    
    console.log("📍 清除旧GPS数据...");
    $persistentStore.write("", "accurate_gps_location");
    $persistentStore.write("", "location_timestamp");
    
    // 使用Loon的打开URL方式
    console.log("🌤️ 打开天气App...");
    $app.openURL("weather://");
    
    // 等待足够时间让天气App完成定位
    setTimeout(() => {
        console.log("✅ 定位完成，准备检查结果...");
        checkGPSUpdateResult(startTime);
    }, 15000); // 增加到15秒等待
    
}

function checkGPSUpdateResult(startTime) {
    const gpsData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    console.log(`🔍 检查GPS更新结果`);
    console.log(`- 开始时间: ${new Date(startTime).toLocaleString()}`);
    console.log(`- 获取时间戳: ${newTimestamp ? new Date(parseInt(newTimestamp)).toLocaleString() : "无"}`);
    console.log(`- GPS数据: ${gpsData ? "存在" : "不存在"}`);
    
    if (gpsData && newTimestamp) {
        try {
            const location = JSON.parse(gpsData);
            const updateTime = parseInt(newTimestamp);
            
            // 放宽时间验证：5分钟内都算有效
            if (updateTime >= startTime - 300000) {
                const age = Math.round((Date.now() - updateTime) / 60000);
                console.log(`🎉 GPS数据更新成功！`);
                console.log(`📍 坐标: ${location.latitude}, ${location.longitude}`);
                console.log(`📡 来源: ${location.source}`);
                console.log(`⏰ 数据年龄: ${age}分钟`);
            } else {
                console.log(`⚠️ 时间戳验证失败`);
                console.log(`- 开始时间: ${startTime}`);
                console.log(`- 更新时间: ${updateTime}`);
                console.log(`- 时间差: ${startTime - updateTime}ms (更新早于开始时间)`);
            }
        } catch (e) {
            console.log("❌ GPS数据解析失败:", e);
        }
    } else {
        console.log("❌ 未获取到GPS数据");
        console.log("可能原因:");
        console.log("1. 天气App没有触发定位请求");
        console.log("2. GPS拦截脚本未正确执行");
        console.log("3. 网络连接问题");
    }
    $done();
}

main();