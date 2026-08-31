<?php
header("Content-Type: application/json; charset=utf-8");

// JSON受け取り
$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

// JSONが無い場合（空オブジェクト含む）
if (!is_array($data)) {
    echo json_encode([
        "status" => "error",
        "message" => "JSONが受け取れませんでした",
        "raw" => $raw
    ]);
    exit;
}

// 必須項目チェック
$type = $data["type"] ?? "unknown";

// payload が無い場合は空オブジェクトにする
$payload = isset($data["payload"]) && is_array($data["payload"])
    ? $data["payload"]
    : [];

// timestamp
$timestamp = isset($data["timestamp"])
    ? intval($data["timestamp"] / 1000)
    : time();

// 保存フォルダ
$logDir = __DIR__ . "/logs";
if (!is_dir($logDir)) {
    mkdir($logDir, 0777, true);
}

// 日付ごとに保存
$fileName = date("Y-m-d") . ".json";
$filePath = $logDir . "/" . $fileName;

// 既存ログ読み込み
$logs = [];
if (file_exists($filePath)) {
    $logs = json_decode(file_get_contents($filePath), true);
    if (!is_array($logs)) $logs = [];
}

// 追加ログ
$logs[] = [
    "timestamp" => $timestamp,
    "type" => $type,
    "payload" => $payload
];

// 保存
file_put_contents(
    $filePath,
    json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
);

// レスポンス
echo json_encode(["status" => "ok"]);
