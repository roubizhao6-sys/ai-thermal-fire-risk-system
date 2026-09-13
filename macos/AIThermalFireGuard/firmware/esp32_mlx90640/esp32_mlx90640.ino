/*
 * AI热感火警风险检测系统 - ESP32-S3 + MLX90640 示例固件
 *
 * 依赖库：
 *  - Adafruit MLX90640
 *  - ArduinoJson
 *  - WebSocketsServer (Links2004)
 *
 * 接线：
 *  MLX90640 VIN -> ESP32-S3 3V3
 *  MLX90640 GND -> ESP32-S3 GND
 *  MLX90640 SDA -> GPIO 8
 *  MLX90640 SCL -> GPIO 9
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MLX90640.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WebSocketsServer.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

Adafruit_MLX90640 mlx;
WebSocketsServer webSocket(81);
float frameBuffer[32 * 24];
uint32_t lastFrameAt = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WebSocket: ws://");
  Serial.print(WiFi.localIP());
  Serial.println(":81/");
}

void buildAndSendFrame() {
  if (mlx.getFrame(frameBuffer) != 0) {
    return;
  }

  float minTemp = frameBuffer[0];
  float maxTemp = frameBuffer[0];
  float sumTemp = 0;
  int maxIndex = 0;

  for (int i = 0; i < 32 * 24; i++) {
    minTemp = min(minTemp, frameBuffer[i]);
    sumTemp += frameBuffer[i];
    if (frameBuffer[i] > maxTemp) {
      maxTemp = frameBuffer[i];
      maxIndex = i;
    }
  }

  const float averageTemp = sumTemp / (32.0f * 24.0f);
  const int maxX = maxIndex % 32;
  const int maxY = maxIndex / 32;

  DynamicJsonDocument doc(12288);
  doc["width"] = 32;
  doc["height"] = 24;
  doc["min_temp"] = minTemp;
  doc["max_temp"] = maxTemp;
  doc["average_temp"] = averageTemp;
  doc["source"] = "ESP32-S3 MLX90640";

  if (maxTemp >= 65) {
    doc["risk"] = "high";
  } else if (maxTemp >= 45) {
    doc["risk"] = "medium";
  } else {
    doc["risk"] = "low";
  }

  JsonArray temperatures = doc["temperatures"].to<JsonArray>();
  for (int i = 0; i < 32 * 24; i++) {
    temperatures.add(round(frameBuffer[i] * 10.0f) / 10.0f);
  }

  JsonArray hotspots = doc["hotspots"].to<JsonArray>();
  JsonObject hotspot = hotspots.add<JsonObject>();
  hotspot["x"] = constrain((maxX - 2) / 32.0f, 0.0f, 0.9f);
  hotspot["y"] = constrain((maxY - 2) / 24.0f, 0.0f, 0.9f);
  hotspot["width"] = 0.15;
  hotspot["height"] = 0.18;
  hotspot["temp"] = maxTemp;
  hotspot["confidence"] = 0.92;

  String payload;
  serializeJson(doc, payload);
  Serial.println(payload);
  webSocket.broadcastTXT(payload);
}

void onWebSocketEvent(uint8_t client, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("WebSocket client connected: %u\n", client);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Wire.begin(8, 9);
  Wire.setClock(400000);

  if (!mlx.begin(MLX90640_I2CADDR_DEFAULT, &Wire)) {
    Serial.println("MLX90640 not found. Check wiring and power.");
    while (true) {
      delay(1000);
    }
  }

  mlx.setMode(MLX90640_CHESS);
  mlx.setResolution(MLX90640_ADC_18BIT);
  mlx.setRefreshRate(MLX90640_4_HZ);

  connectWiFi();
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
}

void loop() {
  webSocket.loop();

  if (millis() - lastFrameAt >= 500) {
    lastFrameAt = millis();
    buildAndSendFrame();
  }
}
