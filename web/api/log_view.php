<?php
header("Content-Type: text/html; charset=utf-8");

// ログフォルダ
$logDir = __DIR__ . "/logs";

// 今日のログファイル
$today = date("Y-m-d");
$filePath = $logDir . "/" . $today . ".json";

// ファイルが無い場合
if (!file_exists($filePath)) {
    echo "<h2>今日のログはありません</h2>";
    exit;
}

// JSON読み込み
$json = file_get_contents($filePath);
$logs = json_decode($json, true);

// 壊れたJSONの場合
if (!is_array($logs)) {
    echo "<h2>ログファイルが壊れています</h2>";
    exit;
}

// HTML表示
echo "<h1>今日のログ一覧 ($today)</h1>";

foreach ($logs as $log) {
    echo "<div style='margin-bottom:20px;padding:10px;border:1px solid #ccc;'>";
    echo "<strong>タイプ:</strong> " . htmlspecialchars($log["type"]) . "<br>";
    echo "<strong>時間:</strong> " . date("Y-m-d H:i:s", $log["timestamp"]) . "<br>";
    echo "<strong>内容:</strong><pre>" . json_encode($log["payload"], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "</pre>";
    echo "</div>";
}
