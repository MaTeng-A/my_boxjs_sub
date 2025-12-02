// 名称: Loon版GPS拦截器
// 描述: 在Loon中拦截多种应用的GPS坐标
// 版本: 5.0 - Loon适配版

const isRequest = typeof $request !== 'undefined';
console.log(`🎯 GPS拦截器启动 (模式: ${isRequest ? '拦截' : '手动检查'})`);

// 存储键名
const STORAGE_KEY = "gps_location_data";
const TIMESTAMP_KEY = "gps_timestamp";

if (isRequest) {
    handleRequest($request);
} else {
    handleManualCheck();
}

function handleRequest(request) {
    console.log("✅ 拦截到请求:", request.url);
    
    const url = request.url;
    const headers = request.headers || {};
    let lat, lng, appName, sourceType;
    
    // 判断应用来源并提取坐标
    const detectedApp = detectAppAndExtractCoords(url, headers);
    
    if (detectedApp) {
        lat = detectedApp.lat;
        lng = detectedApp.lng;
        appName = detectedApp.appName;
        sourceType = detectedApp.sourceType;
        console.log(`🎯 从 ${appName} 提取坐标: ${lat}, ${lng}`);
        
        // 保存GPS数据
        saveLocationData(lat, lng, appName, url, sourceType);
        
        // 获取地址并发送通知
        getAddressAndNotify(lat, lng, appName, Date.now());
    } else {
        console.log("❌ 未找到坐标信息");
    }
    
    // 在Loon中完成请求
    $done({});
}

function handleManualCheck() {
    console.log("📊 GPS状态手动检查");
    
    const locationData = $persistentStore.read(STORAGE_KEY);
    const timestamp = $persistentStore.read(TIMESTAMP_KEY);
    
    if (locationData && timestamp) {
        try {
            const data = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - data.timestamp) / 60000);
            const updateTime = new Date(data.timestamp).toLocaleString('zh-CN');
            
            getAddressAndNotify(data.latitude, data.longitude, data.appName, data.timestamp, timeDiff, updateTime);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            sendSimpleNotification("❌ GPS状态检查失败", "数据解析错误", e.message);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        sendSimpleNotification("📍 GPS定位状态", "等待定位数据", "请打开任意定位应用触发GPS定位");
        $done();
    }
}

// 应用检测和坐标提取函数
function detectAppAndExtractCoords(url, headers) {
    let lat, lng, appName, sourceType;
    
    // 1. 天气相关应用
    if (url.includes('weatherkit.apple.com')) {
        const weatherPatterns = [
            /weatherkit\.apple\.com\/v[12]\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
            /[?&]lat=([0-9.-]+)[^&]*[?&]l[on]*g=([0-9.-]+)/i
        ];
        
        for (let pattern of weatherPatterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[2]) {
                lat = parseFloat(match[1]).toFixed(6);
                lng = parseFloat(match[2]).toFixed(6);
                appName = "苹果天气";
                sourceType = "weather";
                break;
            }
        }
    }
    
    // 2. 高德地图
    else if (url.includes('amap.com') || url.includes('gaode.com')) {
        const patterns = [
            /[?&]location=([0-9.-]+)%2C([0-9.-]+)/,
            /[?&]lat=([0-9.-]+)[^&]*[?&]lon=([0-9.-]+)/i,
            /[?&]x=([0-9.-]+)[^&]*[?&]y=([0-9.-]+)/i
        ];
        
        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[2]) {
                lat = parseFloat(match[1]).toFixed(6);
                lng = parseFloat(match[2]).toFixed(6);
                appName = "高德地图";
                sourceType = "map";
                break;
            }
        }
    }
    
    // 3. 百度地图
    else if (url.includes('baidu.com') && (url.includes('map') || url.includes('location'))) {
        const patterns = [
            /[?&]lat=([0-9.-]+)[^&]*[?&]lng=([0-9.-]+)/i,
            /[?&]pointx=([0-9.-]+)[^&]*[?&]pointy=([0-9.-]+)/i,
            /[?&]coord=([0-9.-]+)%2C([0-9.-]+)/
        ];
        
        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[2]) {
                lat = parseFloat(match[1]).toFixed(6);
                lng = parseFloat(match[2]).toFixed(6);
                appName = "百度地图";
                sourceType = "map";
                break;
            }
        }
    }
    
    // 4. 小红书
    else if (url.includes('xiaohongshu.com') || url.includes('xhs.cn')) {
        const pattern = /[?&](?:lat|latitude)=([0-9.-]+)[^&]*[?&](?:lng|longitude)=([0-9.-]+)/i;
        const match = url.match(pattern);
        
        if (match && match[1] && match[2]) {
            lat = parseFloat(match[1]).toFixed(6);
            lng = parseFloat(match[2]).toFixed(6);
            appName = "小红书";
            sourceType = "social";
        }
    }
    
    // 5. 通用匹配
    if (!lat) {
        const genericPatterns = [
            /[?&]lat=([0-9.-]+)[^&]*[?&]l[on]*g=([0-9.-]+)/i,
            /[?&]latitude=([0-9.-]+)[^&]*[?&]longitude=([0-9.-]+)/i,
            /[?&]x=([0-9.-]+)[^&]*[?&]y=([0-9.-]+)/i,
            /[?&]coord=([0-9.-]+)[,%2C]([0-9.-]+)/i,
            /[?&]location=([0-9.-]+)[,%2C]([0-9.-]+)/i
        ];
        
        for (let pattern of genericPatterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[2]) {
                lat = parseFloat(match[1]).toFixed(6);
                lng = parseFloat(match[2]).toFixed(6);
                
                // 尝试从域名推断应用名称
                const domain = extractDomain(url);
                appName = getAppNameFromDomain(domain) || "未知应用";
                sourceType = "generic";
                break;
            }
        }
    }
    
    if (lat && lng) {
        return { lat, lng, appName: appName || "未知应用", sourceType: sourceType || "unknown" };
    }
    
    return null;
}

// 保存位置数据
function saveLocationData(lat, lng, appName, url, sourceType) {
    const locationData = {
        latitude: lat,
        longitude: lng,
        timestamp: Date.now(),
        appName: appName,
        sourceType: sourceType,
        url: url,
        accuracy: "高精度GPS",
        device: "iPhone"
    };
    
    $persistentStore.write(JSON.stringify(locationData), STORAGE_KEY);
    $persistentStore.write(Date.now().toString(), TIMESTAMP_KEY);
    console.log("💾 GPS数据已保存");
}

// 获取地址并发送通知
function getAddressAndNotify(lat, lng, appName, timestamp, timeDiffMinutes = null, updateTimeStr = null) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "";
        let fullAddress = "";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    
                    // 构建地址文本（省市区街道）
                    addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    // 获取详细地址
                    fullAddress = result.result.formatted_addresses?.recommend || result.result.address || addressText;
                    
                    // 如果有道路信息，添加到地址文本
                    if (address.street) {
                        addressText += address.street;
                        if (address.street_number) {
                            addressText += address.street_number;
                        }
                    }
                    
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    addressText = "地址解析失败";
                    fullAddress = `错误码: ${result.status}`;
                }
            } catch (e) {
                addressText = "地址数据解析错误";
                fullAddress = e.message;
            }
        } else {
            addressText = "网络请求失败";
            fullAddress = error || `状态码: ${response?.status}`;
        }
        
        // 准备通知内容
        const now = Date.now();
        const timeDiff = timeDiffMinutes !== null ? timeDiffMinutes : Math.round((now - timestamp) / 60000);
        const updateTime = updateTimeStr || new Date(timestamp).toLocaleString('zh-CN');
        
        // 构建通知
        const title = "📍 GPS定位成功";
        const subtitle = addressText || "未知位置";
        
        let body = "";
        if (addressText && fullAddress && addressText !== fullAddress) {
            body += `${addressText}\n`;
            body += `更新时间: ${timeDiff}分钟前\n`;
            body += `数据来源: ${appName}\n`;
            body += `坐标精度: 高精度GPS\n`;
            body += `经纬度: ${lat}, ${lng}\n\n`;
            body += `详细地址:\n${fullAddress}\n\n`;
            body += `${timeDiff}分钟前`;
        } else {
            body += `${addressText || fullAddress}\n`;
            body += `更新时间: ${timeDiff}分钟前\n`;
            body += `数据来源: ${appName}\n`;
            body += `坐标精度: 高精度GPS\n`;
            body += `经纬度: ${lat}, ${lng}\n\n`;
            body += `${timeDiff}分钟前`;
        }
        
        // 在Loon中发送通知
        $notification.post(title, subtitle, body);
        
        console.log(`📍 发送通知 - 来源: ${appName}, 坐标: ${lat}, ${lng}`);
        
        $done();
    });
}

// 辅助函数：提取域名
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return "";
    }
}

// 辅助函数：根据域名推断应用名称
function getAppNameFromDomain(domain) {
    const domainMap = {
        'weibo.com': '微博',
        'douyin.com': '抖音',
        'toutiao.com': '今日头条',
        'taobao.com': '淘宝',
        'jd.com': '京东',
        'ele.me': '饿了么',
        'ctrip.com': '携程',
        'qunar.com': '去哪儿',
        'didiglobal.com': '滴滴出行',
        'meituan.com': '美团',
        'dianping.com': '大众点评',
        'amap.com': '高德地图',
        'gaode.com': '高德地图',
        'baidu.com': '百度地图',
        'map.qq.com': '腾讯地图',
        'xiaohongshu.com': '小红书',
        'xhs.cn': '小红书',
        'weatherkit.apple.com': '苹果天气'
    };
    
    for (const [key, value] of Object.entries(domainMap)) {
        if (domain.includes(key)) {
            return value;
        }
    }
    
    return null;
}

// 发送简单通知
function sendSimpleNotification(title, subtitle, body) {
    $notification.post(title, subtitle, body);
    $done();
}