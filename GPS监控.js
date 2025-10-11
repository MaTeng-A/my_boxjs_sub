// 名称: 定时段GPS监控
// 描述: 只在5:00-20:00期间更新GPS，其他时间静默
// 作者: Assistant
// 工具: Loon

console.log("⏰ 定时段GPS监控启动");

function main() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 检查当前时间是否在5:00-20:00之间
    const isUpdateTime = currentHour >= 5 && currentHour < 20;
    
    console.log(`🕒 当前时间: ${currentHour}点, 更新时段: ${isUpdateTime ? '是' : '否'}`);
    
    if (isUpdateTime) {
        // 在更新时段内，执行GPS监控逻辑
        executeGPSMonitoring();
    } else {
        // 非更新时段，只显示状态不进行更新
        showSilentStatus();
    }
}

function executeGPSMonitoring() {
    const now = Date.now();
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((now - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    // 更新策略
    if (gpsAge > 240) { // 4小时以上
        console.log("🔄 需要强制更新GPS");
        triggerGPSUpdate("强制更新");
    } else if (gpsAge > 120) { // 2-4小时
        console.log("🔄 建议更新GPS");
        triggerGPSUpdate("建议更新");
    } else if (gpsAge > 60) { // 1-2小时
        console.log("🔄 常规更新GPS");
        triggerGPSUpdate("常规更新");
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        showStatus(gpsAge, "数据新鲜");
    }
}

function triggerGPSUpdate(reason) {
    // 检查网络连接
    $httpClient.get("https://www.apple.com", function(error) {
        if (error) {
            console.log("❌ 无网络连接，跳过GPS更新");
            $notification.post(
                "📍 GPS定位状态", 
                "❌ 更新失败 - 无网络连接",
                "请检查网络后重试"
            );
            return;
        }
        
        console.log(`📱 ${reason}: 启动天气App`);
        $loon.openURL("weather://");
        
        // 10秒后返回Loon
        setTimeout(() => {
            $loon.openURL("loon://");
            console.log("✅ GPS更新流程完成");
        }, 10000);
        
        $notification.post(
            "📍 GPS定位状态", 
            `🔄 ${reason} - 启动天气App`,
            "正在获取最新位置信息..."
        );
    });
}

function showStatus(gpsAge, status) {
    const gpsData = $persistentStore.read("accurate_gps_location");
    
    if (gpsData) {
        try {
            const location = JSON.parse(gpsData);
            const address = $persistentStore.read("location_address") || "未知地址";
            
            // 使用您提供的格式
            $notification.post(
                "📍 GPS定位状态", 
                `${address}`,
                `更新时间: ${gpsAge}分钟前\n数据来源: weatherkit_apple_full\n坐标精度: 高精度 GPS\n经纬度: ${location.latitude}, ${location.longitude}`
            );
        } catch (e) {
            console.log("❌ 状态显示失败:", e);
            // 备用格式
            $notification.post(
                "📍 GPS定位状态", 
                `${status} - ${gpsAge}分钟前`,
                `数据来源: weatherkit_apple_full\n坐标精度: 高精度 GPS`
            );
        }
    }
}

function showSilentStatus() {
    const gpsData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (gpsData && timestamp) {
        try {
            const location = JSON.parse(gpsData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            const currentHour = new Date().getHours();
            const address = $persistentStore.read("location_address") || "未知地址";
            
            console.log(`💤 非更新时段(${currentHour}点)，静默模式`);
            
            // 只在数据非常陈旧时才发送通知
            if (timeDiff > 360) { // 6小时以上
                $notification.post(
                    "📍 GPS定位状态", 
                    `${address}`,
                    `更新时间: ${timeDiff}分钟前\n数据来源: weatherkit_apple_full\n坐标精度: 高精度 GPS\n经纬度: ${location.latitude}, ${location.longitude}\n\n💤 非更新时段，明日5点后自动更新`
                );
            } else {
                // 数据不算太旧，完全静默
                console.log(`💤 数据年龄${timeDiff}分钟，保持静默`);
            }
        } catch (e) {
            console.log("❌ 静默状态检查失败:", e);
        }
    } else {
        console.log("❌ 无GPS数据可用");
    }
}

main();
$done();
