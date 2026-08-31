// ローディング画面のアニメーション
window.addEventListener("load", () => {
    const bar = document.querySelector(".loading-bar-fill");
    const welcome = document.getElementById("welcome-text");
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");

    // バーを左→右へ伸ばす
    setTimeout(() => {
        bar.style.width = "100%";
    }, 300);

    // バーが満タンになったら「ようこそ」表示
    setTimeout(() => {
        welcome.style.display = "block";
    }, 3000);

    // ローディング画面をフェードアウト
    setTimeout(() => {
        loading.classList.add("fade-out");
    }, 3800);

    // 本体をフェードインして表示
    setTimeout(() => {
        loading.style.display = "none";
        content.style.display = "block";
        content.classList.add("fade-in");
    }, 5200);
});

// サイドバーのメニューを押したら右側に読み込む
function loadPage(url) {
    document.getElementById("mainFrame").src = url;
}
