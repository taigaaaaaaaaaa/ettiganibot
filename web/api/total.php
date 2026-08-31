<?php
header("Content-Type: application/json");

// botフォルダの total.json を絶対パスで読む
$jsonPath = "/bots/えっちがにbot二台目/ettiganibot/total.json";

if (file_exists($jsonPath)) {
    echo file_get_contents($jsonPath);
} else {
    echo json_encode(["error" => "total.json not found"]);
}
