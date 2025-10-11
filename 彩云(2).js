// 名称: 稳定精准天气日报 (GPS增强版)
// 描述: 基于苹果WeatherKit GPS定位 + 腾讯地图IP定位，包含诗句和明日预报
// 作者: Assistant
// 更新时间: 2025-10-10
// 修改: GPS缓存3小时，22:17双通知

// === API 配置 ===
const CAIYUN_TOKEN = "iaJd9yTvsg3496vi";
const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
const TIANAPI_KEY1 = "8fb6b3bc5bbe9ee420193601d13f9162";
const TIANAPI_KEY2 = "8fb6b3bc5bbe9ee420193601d13f9162";

// === 主函数 ===
function main() {
    console.log("🌤️ 开始获取天气信息...");
    
    // 优先使用GPS定位 - 使用拦截脚本的键名
    const gpsData = $persistentStore.read("accurate_gps_location");
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    
    if (gpsData && gpsTimestamp) {
        try {
            const location = JSON.parse(gpsData);
            const now = Date.now();
            const timeDiff = now - parseInt(gpsTimestamp);
            
            // GPS数据在3小时内有效（从2小时改为3小时）
            if (timeDiff < 3 * 60 * 60 * 1000) {
                console.log("✅ 使用高精度GPS定位");
                console.log(`📍 GPS坐标: ${location.latitude}, ${location.longitude}`);
                
                // 使用GPS坐标获取地址信息
                getAddressFromGPSCoordinates(location.latitude, location.longitude)
                    .then(address => {
                        getCaiyunWeather(
                            location.latitude, 
                            location.longitude, 
                            address.province, 
                            address.city, 
                            address.district
                        );
                    })
                    .catch(error => {
                        console.log("❌ 地址获取失败，使用坐标直接获取天气:", error);
                        getCaiyunWeather(location.latitude, location.longitude, "", "", "");
                    });
                return;
            } else {
                console.log("📝 GPS定位数据已过期，使用IP定位");
            }
        } catch (e) {
            console.log("❌ GPS定位数据解析失败，使用IP定位:", e);
        }
    }
    
    // 降级到IP定位
    console.log("🔄 使用IP定位");
    getIPLocation();
}

// === 根据GPS坐标获取地址信息 ===
function getAddressFromGPSCoordinates(lat, lng) {
    return new Promise((resolve, reject) => {
        const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
        
        $httpClient.get(geocoderUrl, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    resolve({
                        province: address.province,
                        city: address.city,
                        district: address.district,
                        street: address.street || ""
                    });
                } else {
                    reject(new Error("逆地理编码失败"));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// === 腾讯地图IP定位 ===
function getIPLocation() {
    const ipUrl = `https://apis.map.qq.com/ws/location/v1/ip?key=${TENCENT_TOKEN}`;
    
    $httpClient.get(ipUrl, function(error, response, data) {
        if (error) {
            handleError("定位失败", error);
            return;
        }
        
        try {
            const result = JSON.parse(data);
            
            if (result.status === 0) {
                const location = result.result;
                const lat = location.location.lat;
                const lng = location.location.lng;
                const province = location.ad_info.province;
                const city = location.ad_info.city;
                const district = location.ad_info.district;
                
                console.log(`📍 IP定位结果: ${province}${city}${district}`);
                
                // 获取天气数据
                getCaiyunWeather(lat, lng, province, city, district);
                
            } else {
                handleError("定位失败", result.message);
            }
            
        } catch (e) {
            handleError("定位数据解析失败", e.message);
        }
    });
}

// === 获取彩云天气 ===
function getCaiyunWeather(lat, lng, province, city, district) {
    const weatherUrl = `https://api.caiyunapp.com/v2.6/${CAIYUN_TOKEN}/${lng},${lat}/weather?alert=true`;
    
    console.log("⏳ 获取彩云天气数据...");
    
    $httpClient.get(weatherUrl, function(error, response, data) {
        if (error) {
            handleError("天气获取失败", error);
            return;
        }
        
        try {
            const weatherData = JSON.parse(data);
            if (weatherData.status === "ok") {
                console.log("✅ 天气数据获取成功");
                
                // 检查是否是22:17及之后
                const isLastRun = isLastRunTime();
                console.log(`最后运行时段(22:17及之后): ${isLastRun}`);
                
                if (isLastRun) {
                    // 22:17及之后：先发送今日天气预报，然后间隔1秒发送明日天气预报
                    console.log("🕙 22:17最后一次运行，发送双通知");
                    
                    // 先发送今日天气预报
                    getTianapiData(weatherData, province, city, district, true);
                    
                    // 间隔1秒后发送明日天气预报
                    setTimeout(() => {
                        processTomorrowWeather(weatherData, province, city, district);
                    }, 1000);
                    
                } else {
                    // 正常时段显示当天天气+诗句
                    getTianapiData(weatherData, province, city, district, false);
                }
                
            } else {
                handleError("天气获取失败", weatherData.error || "未知错误");
            }
        } catch (e) {
            handleError("天气数据解析失败", e.message);
        }
    });
}

// === 获取天行数据（诗句）===
function getTianapiData(weatherData, province, city, district, isLastRun) {
    const skycon = weatherData.result.realtime.skycon;
    const tqtype = getTianapiWeatherType(skycon);
    
    let poetryUrl = `https://api.tianapi.com/tianqishiju/index?key=${TIANAPI_KEY1}`;
    if (tqtype) {
        poetryUrl += `&tqtype=${tqtype}`;
        console.log(`📜 使用指定天气类型: ${tqtype}`);
    } else {
        console.log("📜 使用随机天气诗句");
    }
    
    console.log("📜 获取天气诗句...");
    
    $httpClient.get(poetryUrl, function(error, response, poetryData) {
        let poetry = "今日天气宜人，愿您心情舒畅。";
        if (!error) {
            try {
                const poetryJson = JSON.parse(poetryData);
                if (poetryJson.code === 200 && poetryJson.newslist && poetryJson.newslist.length > 0) {
                    poetry = poetryJson.newslist[0].content;
                    console.log("✅ 天气诗句获取成功");
                }
            } catch (e) {
                console.log("❌ 天气诗句获取失败");
            }
        }
        
        // 处理当天天气数据
        processTodayWeather(weatherData, province, city, district, poetry, isLastRun);
    });
}

// === 处理当天天气数据 ===
function processTodayWeather(weatherData, province, city, district, poetry, isLastRun) {
    try {
        const realtime = weatherData.result.realtime;
        const hourly = weatherData.result.hourly;
        const daily = weatherData.result.daily;
        const alert = weatherData.result.alert;
        const keypoint = weatherData.result.forecast_keypoint;
        
        // 当前天气数据
        const temperature = Math.round(realtime.temperature);
        const apparentTemperature = Math.round(realtime.apparent_temperature);
        const humidity = Math.round(realtime.humidity * 100);
        const windSpeed = Math.round(realtime.wind.speed);
        const windDirection = getWindDirection(realtime.wind.direction);
        const pressure = Math.round(realtime.pressure / 100);
        const visibility = (realtime.visibility / 1000).toFixed(1);
        const skycon = realtime.skycon;
        const weatherDesc = getWeatherDescription(skycon);
        const airQuality = realtime.air_quality ? realtime.air_quality.description.chn : "未知";
        const pm25 = realtime.air_quality ? Math.round(realtime.air_quality.pm25) : "未知";
        
        // 生活指数
        const comfort = realtime.life_index.comfort ? realtime.life_index.comfort.desc : "暂无数据";
        const ultraviolet = realtime.life_index.ultraviolet ? realtime.life_index.ultraviolet.desc : "暂无数据";
        
        // 今日温度范围
        const maxTemp = Math.round(daily.temperature[0].max);
        const minTemp = Math.round(daily.temperature[0].min);
        
        // 获取天气图标
        const weatherIconUrl = getWeatherIcon(skycon);
        
        // 构建通知内容
        const title = isLastRun ? "🌤️ 今日天气总结" : "🌤️ 诗意天气日报";
        
        // 显示定位来源
        const gpsData = $persistentStore.read("accurate_gps_location");
        let locationSource = "📍";
        if (gpsData) {
            const location = JSON.parse(gpsData);
            if (location.source === "weatherkit_apple_full") {
                locationSource = "📍📡"; // GPS图标+信号图标
            }
        }
        
        const subtitle = `${locationSource}${province}${city}${district} (${minTemp}°C~${maxTemp}°C) | ${temperature}°C | ${weatherDesc}`;
        
        let body = "";
        
        // 空气质量信息
        body += `🌫️ 空气质量: ${airQuality}   🫧 PM2.5: ${pm25}\n`;
        body += `🌡️ 体感${comfort} ${apparentTemperature}°C   💧 湿度 ${humidity}%\n`;
        body += `🌬️ ${windDirection}风 ${windSpeed}km/h   📊 气压 ${pressure}hPa\n`;
        body += `👁️ 能见度 ${visibility}km   ☀️ 紫外线${ultraviolet}\n\n`;
        
        // 未来三小时预报
        let hourlyForecast = "";
        for (let i = 0; i < 3 && i < hourly.skycon.length; i++) {
            const hourTime = new Date(hourly.skycon[i].datetime);
            const currentHour = hourTime.getHours();
            const nextHour = currentHour + 1;
            const temp = Math.round(hourly.temperature[i].value);
            const hourSkycon = hourly.skycon[i].value;
            const hourDesc = getWeatherDescription(hourSkycon);
            
            hourlyForecast += `      ${currentHour.toString().padStart(2, '0')}-${nextHour.toString().padStart(2, '0')}时 ${hourDesc} ${temp}°C\n`;
        }
        
        if (hourlyForecast) {
            body += `⏰ 未来三小时预报:\n${hourlyForecast}\n`;
        }
        
        // 预警信息
        if (alert && alert.content && alert.content.length > 0) {
            body += "⚠️ 天气预警:\n";
            alert.content.forEach((alertItem, index) => {
                if (index < 2) {
                    body += `   • ${alertItem.title}\n`;
                }
            });
            body += "\n";
        }
        
        // 关键点内容
        if (keypoint) {
            body += `💡 ${keypoint}\n`;
        }
        
        // 诗句
        body += `📜 ${poetry}`;
        
        console.log("✅ 准备发送当天天气通知");
        
        // 发送通知
        $notification.post(title, subtitle, body, {
            "icon": weatherIconUrl
        });
        
        // 如果不是最后一次运行，则结束脚本
        if (!isLastRun) {
            $done();
        }
        
    } catch (e) {
        handleError("天气数据处理失败", e.message);
    }
}

// === 处理明日天气预报 ===
function processTomorrowWeather(weatherData, province, city, district) {
    try {
        const daily = weatherData.result.daily;
        const realtime = weatherData.result.realtime;
        
        // 获取第二天天气信息
        const tomorrowTemp = daily.temperature[1];
        const tomorrowMaxTemp = Math.round(tomorrowTemp.max);
        const tomorrowMinTemp = Math.round(tomorrowTemp.min);
        const tomorrowSkycon = daily.skycon[1].value;
        const tomorrowWeatherDesc = getWeatherDescription(tomorrowSkycon);
        
        // 日出日落时间
        const sunriseTime = daily.astro[1].sunrise.time;
        const sunsetTime = daily.astro[1].sunset.time;
        
        // 穿衣建议和带伞提醒
        const dressingAdvice = getDressingAdvice(tomorrowMaxTemp, tomorrowWeatherDesc);
        const umbrellaAdvice = getUmbrellaAdvice(tomorrowWeatherDesc);
        
        // 获取明日天气图标
        const tomorrowWeatherIconUrl = getWeatherIcon(tomorrowSkycon);
        
        // 当前天气简要信息
        const currentTemp = Math.round(realtime.temperature);
        const airQuality = realtime.air_quality ? realtime.air_quality.description.chn : "未知";
        
        const title = "🌙 明日天气预告";
        const subtitle = `📍${province}${city}${district} 明日${tomorrowWeatherDesc}`;
        
        let body = "";
        body += `🌡️ 温度范围: ${tomorrowMinTemp}°C ~ ${tomorrowMaxTemp}°C\n`;
        body += `🌈 天气状况: ${tomorrowWeatherDesc}\n\n`;
        body += `${dressingAdvice}\n`;
        body += `${umbrellaAdvice}\n\n`;
        body += `🌅 日出: ${sunriseTime}   🌇 日落: ${sunsetTime}\n\n`;
        body += `📊 当前温度: ${currentTemp}°C | 空气质量: ${airQuality}`;
        
        console.log("✅ 准备发送明日天气预报");
        
        // 发送通知
        $notification.post(title, subtitle, body, {
            "icon": tomorrowWeatherIconUrl
        });
        
        $done();
        
    } catch (e) {
        handleError("明日天气数据处理失败", e.message);
    }
}

// === 辅助函数 ===

// 检查是否是22:17及之后
function isLastRunTime() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return hour > 22 || (hour === 22 && minute >= 17);
}

// 天气图标映射
function getWeatherIcon(skycon) {
    const iconMap = {
        "CLEAR_DAY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLEAR_DAY.gif",
        "CLEAR_NIGHT": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLEAR_NIGHT.gif",
        "PARTLY_CLOUDY_DAY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/PARTLY_CLOUDY_DAY.gif",
        "PARTLY_CLOUDY_NIGHT": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/PARTLY_CLOUDY_NIGHT.gif",
        "CLOUDY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLOUDY.gif",
        "LIGHT_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/LIGHT_RAIN.gif",
        "MODERATE_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/MODERATE_RAIN.gif",
        "HEAVY_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_RAIN.gif",
        "STORM_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/STORM_RAIN.gif",
        "LIGHT_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/LIGHT_SNOW.gif",
        "MODERATE_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/MODERATE_SNOW.gif",
        "HEAVY_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_SNOW.gif",
        "STORM_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_SNOW.gif",
        "FOG": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/FOG.gif",
        "WIND": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/WIND.gif",
        "HAZE": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HAZE.gif"
    };
    return iconMap[skycon] || "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLOUDY.gif";
}

// 天气描述映射
function getWeatherDescription(skycon) {
    const descMap = {
        "CLEAR_DAY": "☀️ 晴朗", "CLEAR_NIGHT": "✨ 晴朗",
        "PARTLY_CLOUDY_DAY": "⛅ 多云", "PARTLY_CLOUDY_NIGHT": "☁️ 多云",
        "CLOUDY": "☁️ 阴天", "LIGHT_RAIN": "🌦️ 小雨", 
        "MODERATE_RAIN": "🌧️ 中雨", "HEAVY_RAIN": "⛈️ 大雨",
        "STORM_RAIN": "🌩️ 暴雨", "LIGHT_SNOW": "❄️ 小雪",
        "MODERATE_SNOW": "🌨️ 中雪", "HEAVY_SNOW": "☃️ 大雪",
        "STORM_SNOW": "❄️ 暴雪", "FOG": "🌫️ 雾天",
        "WIND": "💨 大风", "HAZE": "😷 雾霾"
    };
    return descMap[skycon] || "🌤️ 未知";
}

// 风向描述
function getWindDirection(degree) {
    const directions = ["北", "北东北", "东北", "东东北", "东", "东东南", "东南", "南东南", 
                       "南", "南西南", "西南", "西西南", "西", "西西北", "西北", "北西北"];
    const index = Math.round(((degree %= 360) < 0 ? degree + 360 : degree) / 22.5) % 16;
    return directions[index];
}

// 穿衣建议
function getDressingAdvice(temperature, weatherDesc) {
    const temp = parseInt(temperature);
    if (temp >= 28) return "👕 天气炎热，建议穿短袖、短裤等清凉夏季服装";
    else if (temp >= 24) return "👕 天气较热，建议穿短袖、薄长裤等夏季服装";
    else if (temp >= 18) return "👕 温度舒适，建议穿长袖、薄外套等春秋过渡装";
    else if (temp >= 12) return "🧥 天气较凉，建议穿夹克、薄毛衣等春秋服装";
    else if (temp >= 5) return "🧥 天气冷，建议穿棉衣、厚外套等冬季服装";
    else return "🧥 天气寒冷，建议穿羽绒服、厚棉衣等保暖服装";
}

// 带伞提醒
function getUmbrellaAdvice(weatherDesc) {
    if (weatherDesc.includes("雨") || weatherDesc.includes("雪")) return "🌂 明天有降水，记得带伞哦！";
    else if (weatherDesc.includes("阴") || weatherDesc.includes("云")) return "🌂 明天可能转阴，建议备伞以防万一";
    else return "☀️ 明天天气晴朗，无需带伞";
}

// 天行数据天气类型映射
function getTianapiWeatherType(skycon) {
    const typeMap = {
        "CLEAR_DAY": 9, "CLEAR_NIGHT": 9,
        "PARTLY_CLOUDY_DAY": 2, "PARTLY_CLOUDY_NIGHT": 2,
        "CLOUDY": 10, "LIGHT_RAIN": 3, "MODERATE_RAIN": 3,
        "HEAVY_RAIN": 3, "STORM_RAIN": 8, "LIGHT_SNOW": 4,
        "MODERATE_SNOW": 4, "HEAVY_SNOW": 4, "STORM_SNOW": 4,
        "FOG": 7, "WIND": 1, "HAZE": 7
    };
    return typeMap[skycon] || null;
}

// 错误处理
function handleError(title, message) {
    console.error(`❌ 错误: ${title} - ${message}`);
    $notification.post("❌ " + title, message, "");
    $done();
}

// === 启动脚本 ===
main();