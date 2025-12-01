// 名称: 完整GPS定位（增强版）
// 描述: 拦截天气GPS坐标 + 手动更新接口
// 作者: Assistant
// 版本: 3.0 - 增强版

console.log("🎯 GPS拦截脚本启动（增强版）");

// 检查是否有手动更新命令
const manualUpdateCommand = $persistentStore.read("gps_manual_update");
if (manualUpdateCommand) {
    console.log("🔄 检测到手动更新命令");
    handleManualUpdate(manualUpdateCommand);
}

if (typeof $request !== "undefined") {
    // 正常的拦截逻辑
    handleWeatherRequest();
} else {
    // 手动检查模式
    handleManualCheck();
}

function handleManualUpdate(command) {
    try {
        const data = JSON.parse(command);
        console.log("📝 执行手动更新:");
        console.log(`  坐标: ${data.latitude}, ${data.longitude}`);
        console.log(`  来源: ${data.source || "manual"}`);
        
        // 更新GPS数据
        const locationData = {
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: Date.now(),
            source: data.source || "manual_update",
            accuracy: "high",
            url: "manual://update"
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 手动更新完成");
        
        // 清除命令
        $persistentStore.write("", "gps_manual_update");
        
        // 如果是手动检查模式，直接结束
        if (typeof $request === "undefined") {
            showCurrentStatus();
        }
    } catch (e) {
        console.log("❌ 手动更新命令解析失败:", e);
        $persistentStore.write("", "gps_manual_update");
    }
}

function handleWeatherRequest() {
    console.log("✅ 拦截到天气请求:", $request.url);
    
    // 原有的坐标提取逻辑
    const url = $request.url;
    let lat, lng;
    
    const patterns = [
        /weatherkit\.apple\.com\/v[12]\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /weatherkit\.apple\.com\/v[12]\/availability\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/,
        /[?&]latitude=([0-9.-]+)[&]?.*[?&]longitude=([0-9.-]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = match[1];
            lng = match[2];
            console.log(`🎯 匹配到坐标: ${lat}, ${lng}`);
            break;
        }
    }
    
    if (lat && lng) {
        console.log(`📍 提取坐标: ${lat}, ${lng}`);
        
        // 保存GPS数据
        const locationData = {
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            source: "weatherkit_apple",
            accuracy: "high",
            url: url
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 GPS数据已保存");
    } else {
        console.log("❌ 未找到坐标信息");
    }
    
    $done({});
}

function handleManualCheck() {
    console.log("📊 GPS状态检查");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            console.log(`🌍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            console.log(`📡 来源: ${location.source || "未知"}`);
            console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
            
            getDetailedAddress(location.latitude, location.longitude, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        $done();
    }
}

function showCurrentStatus() {
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            console.log(`📍 当前坐标: ${location.latitude}, ${location.longitude}`);
            console.log(`📡 来源: ${location.source || "未知"}`);
            console.log(`⏰ 数据年龄: ${timeDiff}分钟`);
            
            getDetailedAddress(location.latitude, location.longitude, timeDiff);
        } catch (e) {
            console.log("❌ 显示状态失败:", e);
            $done();
        }
    } else {
        console.log("❌ 无GPS数据");
        $done();
    }
}

function getDetailedAddress(lat, lng, timeDiff) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "地址解析中...";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province}${address.city}${address.district}`;
                    if (address.street) addressText += `${address.street}`;
                    if (address.street_number) addressText += `${address.street_number}`;
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    addressText = "地址解析失败";
                }
            } catch (e) {
                addressText = "地址数据解析错误";
            }
        } else {
            addressText = "网络请求失败";
        }
        
        console.log(`📍 GPS定位状态 - 坐标: ${lat}, ${lng}`);
        console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
        console.log(`🏠 详细地址: ${addressText}`);
        
        $done();
    });
}