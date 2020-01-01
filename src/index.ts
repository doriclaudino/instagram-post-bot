import puppeteer from "puppeteer";
require("dotenv").config({ path: "../src/.env" });
require("source-map-support").install();
// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
import * as firebase from "firebase/app";

// Add the Firebase services that you want to use
import "firebase/auth";
import "firebase/firestore";

// TODO: Replace the following with your app's Firebase project configuration
import * as firebaseConfig from "./firebaseConfig.json";

const connectToFirebase = () => {
  console.log(`${shortDate()} initAndLoginDatabase`);
  firebase.initializeApp(firebaseConfig);
  firebase
    .auth()
    .signInWithEmailAndPassword(
      process.env.FIRESTORE_USER,
      process.env.FIRESTORE_PASSWORD
    );
};

const hoursAgo = hours =>
  Math.round(new Date().getTime() / 1000 - hours * 60 * 60);

/**
 * create your .env
 * IG_USERNAME= '***'
 * IG_PASSWORD= '***'
 * IMG_DIR= '***'
 */

const config = {
  base_url: "https://www.instagram.com",
  username: process.env.IG_USERNAME,
  password: process.env.IG_PASSWORD,
  settings: {
    headless: false,
    save_image_to_path: process.env.IMG_DIR,
    image_extension: `jpeg`
  },
  selectors: {
    html_not_log_in: "html.not-logged-in",
    home_to_login_button: "button.sqdOP",
    username_field: 'input[type="text"]',
    password_field: 'input[type="password"]',
    login_button: 'button[type="submit"]',
    not_now_button: ".HoLwm",
    camera_post_stories_post: "button.mTGkH",
    not_now_save_login_info: "button.GAMXX",
    free_text_mode: "button.HsQIV.storiesSpriteText__filled__44",
    free_text_mode_done: "button.KFJu-",
    button_add_to_your_stories:
      "span.storiesSpriteNew_story__outline__24__grey_0"
  }
};

var browser: puppeteer.Browser, page: puppeteer.Page;

/**
 * open the browser, login using user/psw
 */
const openBrowserAndLogin = async () => {
  console.log(`${shortDate()} openBrowserAndLogin`);
  browser = await puppeteer.launch({
    ignoreDefaultArgs: ["--disable-extensions"],
    userDataDir: "./puppeteer-chrome",
    headless: config.settings.headless,
    devtools: true,
    defaultViewport: {
      width: 375,
      height: 667
    }
  });

  page = await browser.newPage();
  await page.emulate(puppeteer.devices["Galaxy S5"]);
  await page.goto(config.base_url, { timeout: 60000 });

  try {
    await page.waitForSelector(config.selectors.html_not_log_in, {
      timeout: 5000
    });
    await page.waitForSelector(config.selectors.home_to_login_button, {
      timeout: 3000
    });
    await page.click(config.selectors.home_to_login_button, { delay: 300 });

    /* Click on the username field using the field selector*/
    await page.waitForSelector(config.selectors.username_field, {
      timeout: 3000
    });
    await page.waitFor(1000);
    await page.click(config.selectors.username_field);
    await page.keyboard.type(config.username);
    await page.click(config.selectors.password_field);
    await page.keyboard.type(config.password);
    await page.click(config.selectors.login_button);
    await page.waitForNavigation();
    await closeAllModals();
  } catch (error) {
    console.log(`${shortDate()} can't find login elements, ${error.message}`);
    //await closeAllModals();
  }
};

/**
 * close all possible modals
 */
const closeAllModals = async () =>
  Promise.all([
    page
      .waitForSelector(config.selectors.not_now_save_login_info, {
        timeout: 5000
      })
      .then(e => page.click(config.selectors.not_now_save_login_info)),
    page
      .waitForSelector(config.selectors.not_now_button, { timeout: 5000 })
      .then(e => page.click(config.selectors.not_now_button))
  ]);

const getStorieData = async () => {
  var db = firebase.firestore(); // Initialize Firebase
  let data = await db
    .collection("msgs")
    .where("state", "==", "ma")
    .where("sent", "==", true)
    .where("t", ">=", hoursAgo(24))
    .where("sent_ig", "==", false)
    .get();

  if (data.empty) throw new Error(`Empty dataset returned`);

  let firstItem = data.docs[0].data();
  let jobImage = "https://i.imgur.com/TpHDcwH.png";
  let rentImage = "https://i.imgur.com/0OxqIoL.png";
  let backgroundImage = "";
  let text = firstItem.text; //or boldText
  let id = data.docs[0].id;

  if (
    firstItem.entities.intent[0].value === "offer_place" ||
    firstItem.entities.intent[0].value === "ask_place"
  )
    backgroundImage = rentImage;
  else if (
    firstItem.entities.intent[0].value === "offer_job" ||
    firstItem.entities.intent[0].value === "ask_job"
  )
    backgroundImage = jobImage;

  return {
    backgroundImage,
    text,
    id
  };
};

const setSentOnInstagram = async msgId =>
  firebase
    .firestore()
    .collection("msgs")
    .doc(msgId)
    .update({ sent_ig: true });

const loadImage = async image_name => {
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.click(config.selectors.camera_post_stories_post) // some button that triggers file selection
  ]);
  let imgPath = getImagePath(image_name);
  await fileChooser.accept([imgPath]);
  await page.waitFor(2500);
};

const shortDate = () => {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

/**
 * update firestore?
 * @param img_id generated image
 */
const postStories = async () => {
  try {
    let data = await getStorieData();
    await createImage(data.text, data.backgroundImage, data.id);

    console.log(
      `${shortDate()} postStories... id:${data.id} text:${data.text}`
    );
    await loadImage(data.id);

    await page.click(config.selectors.button_add_to_your_stories);
    await page.waitFor(3000);
    await setSentOnInstagram(data.id);
    await closeAllModals();
  } catch (error) {
    console.log(`${shortDate()} postStories ${error.message}`);
  }
};

//jobs: https://i.imgur.com/TpHDcwH.png
//rent: https://i.imgur.com/0OxqIoL.png
/**
 * generate an image to postupload
 * why: error when type the message using free-text feature on instagram-web
 *
 * @param userText text from user
 * @param backgroundImg img for background
 * @param generated_id messageId
 */
async function createImage(
  userText = `Alugo quarto em Somerville, ótima localização, já disponível, não precisa depósito. *617 501 8664*`,
  backgroundImg = "https://i.imgur.com/0OxqIoL.png",
  generated_id = `teste01`
) {
  var page2 = await browser.newPage();
  await page2.setViewport({ width: 600, height: 800 });

  let fontSize = 2.2;
  if (userText.length < 80) fontSize = 3.6;
  else if (userText.length < 160) fontSize = 2.8;

  page2.setContent(
    `  <!DOCTYPE html>
  <html>
  <head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
  html { 
  background: url(${backgroundImg}) no-repeat center center fixed; 
  -webkit-background-size: cover;
  -moz-background-size: cover;
  -o-background-size: cover;
  background-size: cover;
}


  .centered {
    position: absolute;
    top: 5%;
    left: 20%;
	right: 15%;
  }
  p{
      word-wrap: break-word;
      font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      font-size: 32px;
      font-size: ${fontSize}rem;
	    text-shadow: 
  0 0 1px white,
  0 0 2px white,
  0 0 3px white,
  0 0 4px white,
  0 0 5px white,
  0 0 6px white,
  0 0 7px white,
  0 0 8px white,
  0 0 9px white;
  }
  </style>
  </head>
  <body>
	<div class="centered">
    <p>${userText}</p>
    </div>

  </body>
  </html> 
`,
    { waitUntil: "domcontentloaded" }
  );
  await page2.waitFor(2000);
  await page2.screenshot({
    path: getImagePath(generated_id)
  });
  console.log(`img created ${getImagePath(generated_id)}`);
  await page2.close();
}

const getImagePath = name => {
  return `${config.settings.save_image_to_path}${name}.${config.settings.image_extension}`;
};

const clearInstagramDb = async (hours = 24) => {
  var db = firebase.firestore(); // Initialize Firebase
  let data = await db
    .collection("msgs")
    .where("state", "==", "ma")
    .where("sent", "==", true)
    .where("t", ">=", hoursAgo(hours))
    .get();

  data.docs.forEach(doc => {
    doc.ref.update({ sent_ig: false });
    console.log(`fix: ${doc.id}`);
  });
};

const init = async () => {
  try {
    await connectToFirebase();
    await openBrowserAndLogin();

    while (true) {
      await postStories();
      await page.waitFor(5 * 60 * 1000);
    }
  } catch (error) {
    console.log(`${shortDate()} init ${error.message}`);
  }
};

init();

module.exports = {
  openBrowserAndLogin,
  postStories,
  clearInstagramDb,
  getStorieData,
  connectToFirebase
  //getImagePath,
  //createImage
  //closeAllModals,
  //loadImage
};
