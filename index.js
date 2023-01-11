const { Configuration, OpenAIApi } = require("openai");
const Masto = require('mastodon')
const fs = require('fs');

// Delays code (async, use await)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
//	Initialize Masto Config
const M = new Masto({
  access_token: 'dB7LHNeo039XDE_PnQve0z1BM9SnqFr6BEqw7txlVo4',
  timeout_ms: 60*1000,  // optional HTTP request timeout to apply to all requests.
  api_url: 'https://unigma.net/api/v1/', // optional, defaults to https://mastodon.social/api/v1/
})
// reads 'previous.txt' as raw text
const previous = fs.readFileSync('previous.txt', 'utf8').split('~~~');

// Initialize OpenAI Configuration
const configuration = new Configuration({
  apiKey: process.env['openai'],
});
const openai = new OpenAIApi(configuration);


/** RESPONSE (POST PROMPT RESPONSE GEN) **/
async function postResponse(status_body, parent_id){
	M.post('statuses', { status: status_body, in_reply_to_id: parent_id });
	console.log('Posted!')
}
/** RESPONSE GENERATOR **/
async function generateResponse(toot_raw_content, toot_id){
	const prompt = "Respond to the following tweet as if you are an intelligent and mildly schizophrenic college student in a Twitter honors group, but be sure it's typed like a zoomer, in all lowercase, etc. Your handle is @toothread, anything else is someone else.  '" + toot_raw_content + "'";
	const response = await openai.createCompletion({
  	model: "text-davinci-003",
  	prompt: prompt,
  	temperature: 0,
  	max_tokens: 250,
	}).catch(err=>console.log(err));
	const res = response.data.choices[0].text;

	// Prevent future uses of the same toot
	fs.appendFileSync('previous.txt', toot_raw_content + "~~~", ()=>{});
	previous.push(toot_raw_content);
	
	// Log result (debug)
	console.log("Prompt: " + toot_raw_content + " | Response: " + res);
	postResponse(res, toot_id);
	
}
/** SCANNER **/
async function main(){
	M.get('timelines/public', {limit:5}).then((res) => {
		let timeline = res.data;
		timeline.forEach((toot) => {
			let raw_content = toot.content.replace(/<[^>]*>/g, '');
			let id = toot.id;
			
			if(!previous.find((i) => i === raw_content)){
				// Log the new toot (debug)
				console.log('---------------------------------------------\nNew!')
				console.log(raw_content);

				// Generate and post a response
				generateResponse(raw_content, id);
			}
		})
	})
}
async function run(){
	console.log('Starting Mastodon Bot...');
	console.log('Previous tweets...');
	console.log(previous);
	
	while (true){
		try{
			await main();
			await delay(10000);
		}catch(e){
			await delay(1500000);
		}
		if(previous.length > 50){
			console.log('~~~~~~~~~~~~~~~~~~~~~~~~~');
			console.log('Resetting previous tweets...');
			console.log('~~~~~~~~~~~~~~~~~~~~~~~~~');
			fs.writeFileSync('previous.txt', previous.slice(-10).join('~~~'), 'utf8');
		}
	}
}
run();