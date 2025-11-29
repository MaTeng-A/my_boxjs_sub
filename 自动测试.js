// 名称: 自动GPS触发（HTTP请求版）
// 描述: 通过HTTP请求触发GPS拦截更新
// 作者: Assistant
// 版本: 14.0 - HTTP请求版

console.log("🔄 自动GPS触发启动（HTTP请求版）");

function main() {
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 5) {
        console.log("🔄 通过HTTP请求触发GPS拦截");
        triggerViaHTTP();
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        $done();
    }
}

function triggerViaHTTP() {
    const startTime = Date.now();
    $persistentStore.write(startTime.toString(), "gps_update_start_time");
    
    // 构造天气API请求URL
    const lastLocation = $persistentStore.read("accurate_gps_location");
    let lat = "39.9042", lng = "116.4074"; // 默认北京位置
    
    if (lastLocation) {
        try {
            const location = JSON.parse(lastLocation);
            lat = location.latitude;
            lng = location.longitude;
            console.log(`📍 使用已知位置: ${lat}, ${lng}`);
        } catch (e) {
            console.log("❌ 解析位置数据失败，使用默认位置");
        }
    }
    
    // 使用多个天气API端点增加成功率
    const weatherEndpoints = [
        `https://weatherkit.apple.com/api/v1/weather/zh/${lat}/${lng}?dataSets=currentWeather`,
        `https://weather-data.apple.com/v1/weather/${lat}/${lng}`,
        `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lng}?dataSets=forecastDaily`
    ];
    
    let attempts = 0;
    
    function tryNextEndpoint() {
        if (attempts >= weatherEndpoints.length) {
            console.log("❌ 所有天气端点尝试失败");
            $done();
            return;
        }
        
        const endpoint = weatherEndpoints[attempts];
        attempts++;
        
        console.log(`🌐 尝试天气端点 ${attempts}: ${endpoint}`);
        
        // 发送HTTP请求，这个请求应该被GPS拦截脚本拦截
        $httpClient.get(endpoint, function(error, response, data) {
            if (error) {
                console.log(`❌ 请求失败: ${error}`);
                tryNextEndpoint();
            } else {
                console.log(`✅ 请求完成，状态码: ${response.status}`);
                
                // 无论状态码如何，等待拦截脚本处理
                setTimeout(() => {
                    checkUpdateResult(startTime);
                }, 3000);
            }
        });
    }
    
    tryNextEndpoint();
}

function checkUpdateResult(startTime) {
    const gpsData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    console.log("🔍 检查更新结果");
    
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
                console.log(`⚠️ 拦截到旧数据，年龄: ${age}分钟`);
            }
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
        }
    } else {
        console.log("❌ 未获取到GPS数据");
    }
    $done();
}

main();