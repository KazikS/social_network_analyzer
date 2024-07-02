const api = require('./tgApi');
async function getUser() {
  try {
    const user = await api.call("users.getFullUser", {
      id: {
        _: "inputUserSelf",
      },
    });
    return user;
  } catch (error) {
    console.error("Failed to get user:", error);
    return null;
  }
}

module.exports = getUser;
