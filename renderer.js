let analyzeVKbtn = document.querySelector(".analyze-vk");
let analyzeTGbtn = document.querySelector(".analyze-tg");
let vkLoad = document.querySelector(".vk-load");
let tgLoad = document.querySelector(".tg-load");
let confirmPhoneBtn = document.querySelector(".confirm_phone");
let authWindowTg = document.querySelector(".auth-form-tg");
let authTg = document.querySelector(".auth-tg");

window.electronAPI.onUserStatus((event, user) => {
  updateAuthWindowVisibility(user);
});

authTg.onclick = async () => {
  const phone = document.getElementById("online_phone").value;
  const code = document.getElementById("code").value;
  const password = document.getElementById("password").value;
  console.log("verifBtn clicked");
  try {
    await window.electronAPI.update_config({ phone, code, password });
    window.electronAPI.onUserStatus((event, user) => {
      updateAuthWindowVisibility(user);
    });
  } catch (error) {
    document.querySelector(".undefined-number").style.display = "block";
    document.querySelector(".undefined-number").textContent =
      "Ошибка ввода данных";
  }
};

analyzeVKbtn.onclick = () => {
  vkLoad.style.display = "block";
  vkLoad.classList.add("spinning");
  const url = document.querySelector(".vk-url").value;
  const date = document.querySelector(".vk-date").value.split(" ");
  let startDate = date[1];
  let endDate = date[3];
  console.log(
    "VK Button Clicked. URL:",
    url,
    "Start Date:",
    startDate,
    "End Date:",
    endDate
  );
  analyzeStats(url, startDate, endDate);
};

analyzeTGbtn.onclick = () => {
  tgLoad.style.display = "block";
  tgLoad.classList.add("spinning");
  const url = document.querySelector(".tg-url").value;
  const date = document.querySelector(".tg-date").value.split(" ");
  let startDate = date[1];
  let endDate = date[3];
  console.log(
    "TG Button Clicked. URL:",
    url,
    "Start Date:",
    startDate,
    "End Date:",
    endDate
  );
  analyzeStats(url, startDate, endDate);
};

async function analyzeStats(url, startDate, endDate) {
  const result = await window.electronAPI.analyze({ url, startDate, endDate });

  if (url.includes("vk.com")) {
    document.getElementById("vkPosts").textContent =
      "Количество постов: " + result.filteredPosts.length;
    document.getElementById("vkLikes").textContent =
      "Количество лайков: " + result.totalLikes;
    document.getElementById("vkViews").textContent =
      "Количество просмотров: " + result.totalViews;
    document.getElementById("vkAvgPostsPerWeek").textContent =
      "Среднее количество публикаций в неделю: " +
      result.avgPostsPerWeek.toFixed(2);
    vkLoad.classList.remove("spinning");
    vkLoad.style.display = "none";
  } else if (url.includes("t.me")) {
    document.getElementById("tgPosts").textContent =
      "Количество постов: " + result.totalMessages;
    document.getElementById("tgLikes").textContent =
      "Количество лайков: " + result.totalReactions;
    document.getElementById("tgViews").textContent =
      "Количество просмотров: " + result.totalViews;
    document.getElementById("tgAvgPostsPerWeek").textContent =
      "Среднее количество публикаций в неделю: " +
      result.avgPostsPerWeek.toFixed(2);
    tgLoad.classList.remove("spinning");
    tgLoad.style.display = "none";
  }
}

function updateAuthWindowVisibility(user) {
  if (user) {
    console.log(user);
    authWindowTg.style.display = "none";
  } else {
    authWindowTg.style.display = "flex";
  }
}
