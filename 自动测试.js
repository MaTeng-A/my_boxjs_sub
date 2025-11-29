// 名称: 自动GPS触发
// 描述: 自动触发GPS更新
// 作者: Assistant
// 版本: 1.0

console.log("🔄 自动GPS触发启动");

function main() {
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 5) {
        console.log("🔄 触发GPS更新");
        triggerGPSUpdate();
    } else {
        console.log("✅ GPS数据新鲜");
        $done();
    }
}

function triggerGPSUpdate() {
    const startTime = Date.now();
    
    // 读取最后位置
    const lastLocation = $persistentStore.read("accurate_gps_location");
    let lat = "39.9042", lng = "116.4074";
    
    if (lastLocation) {
        try {
            const location = JSON.parse(lastLocation);
            lat = location.latitude;
            lng = location.longitude;
        } catch (e) {
            console.log("❌ 解析位置失败");
        }
    }
    
    // 发送天气请求触发拦截
    const weatherURL = `https://weatherkit.apple.com/api/v1/weather/zh/${lat}/${lng}?dataSets=currentWeather`;
    console.log(`🌐 发送请求: ${weatherURL}`);
    
    $httpClient.get(weatherURL, function(error, response, data) {
        console.log(`📡 请求完成，状态码: ${response?.status}`);
        
        // 检查更新结果
        setTimeout(() => {
            checkUpdateResult(startTime);
        }, 3000);
    });
}

function checkUpdateResult(startTime) {
    const gpsData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    if (gpsData && newTimestamp) {
        try {
            const location = JSON.parse(gpsData);
            const updateTime = parseInt(newTimestamp);
            const age = Math.round((Date.now() - updateTime) / 60000);
            
            if (updateTime >= startTime) {
                console.log(`🎉 GPS更新成功!`);
                console.log(`📍 坐标: ${location.latitude}, ${location.longitude}`);
                console.log(`📡 来源: ${location.source}`);
                console.log(`⏰ 年龄: ${age}分钟`);
            } else {
                console.log(`⚠️ 数据未更新，年龄: ${age}分钟`);
            }
        } catch (e) {
            console.log("❌ 数据解析失败");
        }
    } else {
        console.log("❌ 无GPS数据");
    }
    $done();
}

main();