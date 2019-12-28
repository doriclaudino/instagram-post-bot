import * as puppeteer from "puppeteer";
require("dotenv").config({ path: "../src/.env" });
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

let browser, page;

/**
 * open the browser, login using user/psw
 */
const openBrowserAndLogin = async () => {
  browser = await puppeteer.launch({
    ignoreDefaultArgs: ["--disable-extensions"],
    //userDataDir: "./puppeteer-chrome",
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
  await page.waitFor(2500);
  await page.click(config.selectors.home_to_login_button);
  await page.waitFor(2500);
  /* Click on the username field using the field selector*/
  await page.click(config.selectors.username_field);
  await page.keyboard.type(config.username);
  await page.click(config.selectors.password_field);
  await page.keyboard.type(config.password);
  await page.click(config.selectors.login_button);
  await page.waitForNavigation();
  await closeAllModals();
};

/**
 * close all possible modals
 */
const closeAllModals = async () => {
  await page.waitFor(1000);
  try {
    page
      .waitForSelector(config.selectors.not_now_save_login_info)
      .then(() => page.click(config.selectors.not_now_save_login_info));
    page
      .waitForSelector(config.selectors.not_now_button)
      .then(() => page.click(config.selectors.not_now_button));
  } catch (error) {
    console.log(error);
  }
};

/**
 * update firestore?
 * @param img_id generated image
 */
const postStories = async img_id => {
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.click(config.selectors.camera_post_stories_post) // some button that triggers file selection
  ]);
  await fileChooser.accept([getImagePath(img_id)]);
  await page.waitFor(2500);
  await page.click(config.selectors.button_add_to_your_stories);
  await page.waitFor(3000);
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

  let fontSize = 2.5;
  if (userText.length < 80) fontSize = 3.6;
  else if (userText.length < 160) fontSize = 3;

  page2.setContent(`  <!DOCTYPE html>
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
    left: 10%;
	right: 10%;
  }
  p{
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
`);

  await page2.screenshot({
    path: getImagePath(generated_id)
  });
  await page2.close();
}

const getImagePath = img => {
  return `${config.settings.save_image_to_path}${img}.${config.settings.image_extension}`;
};
