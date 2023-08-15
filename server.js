const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const natural = require('natural');
const multer = require('multer');

const app = express();

mongoose.connect('mongodb://127.0.0.1:27017/sbDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(__dirname));
app.listen(port, () => console.log(`Listening on port ${port}...`));

const jobSeekerSchema = new mongoose.Schema({
  name: String,
  education: String,
  country: String,
  region: String,
  email: { type: String, unique: true, required: true },
  phone: { type: String, unique: true, required: true },
  skills: String,
  cv: String,
});

const JobSeeker = mongoose.model('JobSeeker', jobSeekerSchema);

const companySchema = new mongoose.Schema({
  company_name: String,
  industry: String,
  country: String,
  region: String,
  email: { type: String, unique: true, required: true },
  phone: { type: String, unique: true, required: true },
  website: String,
  description: String,
  certificate: String,
});

const Company = mongoose.model('Company', companySchema);

const upload = multer({ dest: 'uploads/' });

app.post('/submit-job-seeker', upload.single("cv"), async (req, res) => {
  const jobSeeker = new JobSeeker({
    name: req.body.name,
    education: req.body.education,
    country: req.body.country,
    region: req.body.region,
    email: req.body.email,
    phone: req.body.phone,
    skills: req.body.skills,
    cv: req.file ? req.file.path : null,
  });
  jobSeeker.save()
    .then(() => res.send('Registration successful!'))
    .catch(err => res.status(400).send(err.message));
});

app.post('/submit-company', upload.single('certificate'), (req, res) => {
  const company = new Company({
    company_name: req.body.company_name,
    industry: req.body.industry,
    country: req.body.country,
    region: req.body.region,
    email: req.body.email,
    phone: req.body.phone,
    website: req.body.website,
    description: req.body.description,
    certificate: req.file ? req.file.path : null,
  });
  company.save()
    .then(() => res.send('Registration successful!'))
    .catch(err => res.status(400).send(err.message));
});

app.post('/login-job-seeker', async (req, res) => {
  const emailOrPhone = req.body.emailOrPhone;
  const jobSeeker = await JobSeeker.findOne({
    $or: [{ email: emailOrPhone }, { phone: emailOrPhone }]
  });

  if (jobSeeker) {
    res.json({
        success: true,
        data: jobSeeker
    })
  } else {
    res.status(400).json({success: false,message:'Invalid login credentials.'});
  }
});

app.post('/login-company', async (req, res) => {
  const emailOrPhone = req.body.emailOrPhone;
  const company = await Company.findOne({
    $or: [{ email: emailOrPhone }, { phone: emailOrPhone }]
  });

  if (company) {
    res.redirect(`/CompanyDashboard.html?name=${encodeURIComponent(company.company_name)}`);
  } else {
    res.status(400).send('Invalid login credentials.');
  }
});

app.get('/matched-companies/:job_seeker_id', async (req, res) => {
  try {
    const jobSeekerId = req.params.job_seeker_id;
    const jobSeeker = await JobSeeker.findById(jobSeekerId);
    const companies = await Company.find({ region: jobSeeker.region }).exec();
   
    const tokenizer = new natural.WordTokenizer();
    companies.forEach(company => {
      const tokens = tokenizer.tokenize(company.description);
      company.keywords = tokens;
    });

    
    const jobSeekerSkills = jobSeeker.skills? jobSeeker.skills?.split(', '): []; // Assuming skills are passed as a comma-separated query parameter
    console.log(jobSeekerSkills);
    const matches = [];

    companies.forEach(company => {
      const score = company.keywords.filter(keyword => jobSeekerSkills.includes(keyword)).length;
      if (score >= 2) {
        matches.push({ company, score });
      }
    });

    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 10);

    const result = topMatches.map(match => ({
      name: match.company.company_name,
      phone: match.company.phone,
    }));

    console.log("Matched companies:", result); // Log the matched companies
    res.json({
        success: true,
        data: result
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({success: false, message: 'An error occurred while fetching matched companies.'});
  }
});


