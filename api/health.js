module.exports = async (req,res) => {
  res.status(200).json({ ok:true, ts: new Date().toISOString(), version: 'definitive-clean'});
};
