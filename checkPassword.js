const api = require('./tgApi');
function checkPassword({ srp_id, A, M1 }) {
  return api.call("auth.checkPassword", {
    password: {
      _: "inputCheckPasswordSRP",
      srp_id,
      A,
      M1,
    },
  });
}
module.exports = checkPassword;