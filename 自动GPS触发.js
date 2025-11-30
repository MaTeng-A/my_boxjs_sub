
// 名称: 自动触发GPS更新（兼容拦截脚本版）
// 描述: 自动打开天气App触发GPS拦截，然后关闭
// 作者: Assistant
// 版本: 3.2 - 无通知版

console.log("🔄 自动触发GPS更新启动");

function main() {
    // 读取GPS时间戳
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 5) { // 超过5分钟需要更新
        console.log("🔄 自动触发天气App获取GPS");
        autoTriggerWeatherApp();
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        $done();
    }
}

function autoTriggerWeatherApp() {
    console.log("📱 自动打开天气App...");
    
    // 记录开始时间用于验证
    const startTime = Date.now();
    $persistentStore.write(startTime.toString(), "gps_update_start_time");
    
    // 打开天气App触发GPS拦截
    $loon.openURL("weather://");
    
    // 等待8秒让天气App完成定位
    setTimeout(() => {
        console.log("✅ 等待完成，返回Loon");
        // 返回Loon
        $loon.openURL("loon://");
        
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
                
                // 注释掉所有通知，不再显示任何通知
                /*
                const currentHour = new Date().getHours();
                if (currentHour < 23 && currentHour >= 6) {
                    $notification.post(
                        "📍 自动GPS更新成功", 
                        `坐标: ${location.latitude}, ${location.longitude}`,
                        `来源: ${location.source}\n天气App已自动刷新定位数据`
                    );
                }
                */
            } else {
                console.log("⚠️ GPS数据未更新（时间戳验证失败）");
                // 注释掉通知
                /*
                const currentHour = new Date().getHours();
                if (currentHour < 23 && currentHour >= 6) {
                    $notification.post(
                        "❌ 自动GPS更新失败", 
                        "获取到旧数据",
                        "请重试或检查网络连接"
                    );
                }
                */
            }
        } catch (e) {
            console.log("❌ GPS数据解析失败:", e);
            // 注释掉通知
            /*
            const currentHour = new Date().getHours();
            if (currentHour < 23 && currentHour >= 6) {
                $notification.post(
                    "❌ GPS数据解析失败", 
                    "请检查数据格式",
                    e.toString()
                );
            }
            */
        }
    } else {
        console.log("❌ GPS数据未更新");
        console.log(`详细检查:`);
        console.log(`- location_timestamp: ${newTimestamp}`);
        console.log(`- accurate_gps_location: ${gpsData ? "存在" : "不存在"}`);
        
        // 注释掉通知
        /*
        const currentHour = new Date().getHours();
        if (currentHour < 23 && currentHour >= 6) {
            $notification.post(
                "❌ 自动GPS更新失败", 
                "未能获取新坐标",
                "请检查Loon的GPS拦截配置或网络连接"
            );
        }
        */
    }
    $done();
}

main();
[file content end]