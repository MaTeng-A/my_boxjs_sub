// 名称: 自动触发GPS更新
// 描述: 自动打开天气App触发GPS拦截，然后关闭
// 作者: Assistant
// 修正: 修复了$loon拼写错误

console.log("🔄 自动触发GPS更新启动");

function main() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 只在5:00-20:00之间执行
    if (currentHour >= 5 && currentHour < 20) {
        const gpsTimestamp = $persistentStore.read("location_timestamp");
        const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
        
        console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
        
        if (gpsAge > 60) { // 超过1小时需要更新
            console.log("🔄 自动触发天气App获取GPS");
            autoTriggerWeatherApp();
        } else {
            console.log("✅ GPS数据新鲜，无需更新");
            $done();
        }
    } else {
        console.log("💤 非更新时段，静默模式");
        $done();
    }
}

function autoTriggerWeatherApp() {
    console.log("📱 自动打开天气App...");
    
    // 打开天气App（这会触发GPS请求）
    $loon.openURL("weather://");
    
    // 等待8秒让天气App完成定位
    setTimeout(() => {
        console.log("✅ 等待完成，返回Loon");
        // 返回Loon（相当于"关闭"天气App）
        $loon.openURL("loon://");
        
        // 检查是否成功获取了新坐标
        setTimeout(() => {
            checkGPSUpdateResult();
        }, 2000);
        
    }, 8000);
}

function checkGPSUpdateResult() {
    const oldTimestamp = $persistentStore.read("previous_check_timestamp");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    if (newTimestamp && newTimestamp !== oldTimestamp) {
        console.log("🎉 GPS数据已更新");
        const gpsData = $persistentStore.read("accurate_gps_location");
        
        if (gpsData) {
            try {
                const location = JSON.parse(gpsData);
                $notification.post(
                    "📍 自动GPS更新成功", 
                    `坐标: ${location.latitude}, ${location.longitude}`,
                    "天气App已自动刷新定位数据"
                );
            } catch (e) {
                console.log("❌ GPS数据解析失败:", e);
            }
        }
        
        // 更新检查时间戳
        $persistentStore.write(newTimestamp, "previous_check_timestamp");
    } else {
        console.log("❌ GPS数据未更新");
        $notification.post(
            "❌ 自动GPS更新失败", 
            "未能获取新坐标",
            "请检查网络连接或手动打开天气App"
        );
    }
    $done();
}

main();