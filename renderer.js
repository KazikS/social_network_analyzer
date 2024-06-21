let analyzeVKbtn = document.querySelector(".analyze-vk");
let analyzeTGbtn = document.querySelector(".analyze-tg");
let vkLoad = document.querySelector(".vk-load");
let tgLoad = document.querySelector(".tg-load");
let confirmPhoneBtn = document.querySelector(".confirm_phone");
let isVerifCodeIn = false;
let verifCode = document.querySelector(".confirm_code");


confirmPhoneBtn.onclick = async () => {
  let phoneNumber = document.getElementById("online_phone").value;
  console.log(phoneNumber);
  try {
    const phoneCodeHash = await window.electronAPI.access_phone(phoneNumber);
    localStorage.setItem("phoneCodeHash", phoneCodeHash);
    alert("Код подтверждения отправлен на номер телефона");
    document.getElementById("code").disabled = false;
    confirmPhoneBtn.value = "Войти";
    confirmPhoneBtn.classList.add("confirm_code");
  } catch (error) {
    document.querySelector(".undefined-number").style.display = "block";
    console.error("Error:", error);
    throw error;
  }
};

if (verifCode) {
  console.log('veriffffffff')
  if (verifCode) {
    verifCode.onclick = async () => {
      const phoneNumber = document.getElementById("online-phone").value;
      const code = document.getElementById("code").value;
      const phoneCodeHash = localStorage.getItem("phoneCodeHash");
      try {
        const result = await window.electronAPI.access_code({
          phoneNumber,
          phoneCodeHash,
          code,
        });
        document.querySelector(".auth-form-tg").style.display = "none";
        return result;
      } catch (error) {
        document.querySelector(".undefined-number").style.display = "block";
        document.querySelector(".undefined-number").textContent =
          "Код подтверждения неверен!";
      }
    };
  }
}

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
  ); // Логируем клик и даты
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
  ); // Логируем клик и даты
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
    document.getElementById("vkPosts").textContent =
      "Количество постов: " + result.filteredPosts.length;
    document.getElementById("vkLikes").textContent =
      "Количество лайков: " + result.totalLikes;
    document.getElementById("vkViews").textContent =
      "Количество просмотров: " + result.totalViews;
    document.getElementById("vkAvgPostsPerWeek").textContent =
      "Среднее количество публикаций в неделю: " +
      result.avgPostsPerWeek.toFixed(2);
    tgLoad.classList.remove("spinning");
    tgLoad.style.display = "none";
  }
}
