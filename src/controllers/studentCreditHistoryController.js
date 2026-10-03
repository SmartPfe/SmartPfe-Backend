const { listStudentCreditHistory, getStudentCreditRequest } = require("../services/studentCreditHistoryService");
const { CreditError } = require("../services/creditService");

const respondError = (res, error) => res.status(error instanceof CreditError ? error.status : 500).json({
  message: error instanceof CreditError ? error.message : "Could not load credit history.",
  ...(error instanceof CreditError ? { code: error.code } : {}),
});

const getHistory = async (req, res) => {
  try {
    const { section = "requests", status, kind, search, dateFrom, dateTo, page, limit } = req.query;
    res.json(await listStudentCreditHistory({ userId: req.user._id, section, status, kind, search, dateFrom, dateTo, page, limit }));
  } catch (error) { respondError(res, error); }
};

const getRequest = async (req, res) => {
  try {
    res.json({ request: await getStudentCreditRequest({ userId: req.user._id, requestId: req.params.id }) });
  } catch (error) { respondError(res, error); }
};

module.exports = { getHistory, getRequest };
