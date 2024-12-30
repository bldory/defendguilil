const TWO_PI = Math.PI * 2;

var images = [],
  imageIndex = 0;

var image,
  imageWidth = 263,
  imageHeight = 175;

var vertices = [],
  indices = [],
  fragments = [];

var container = document.getElementById("container");

var clickPosition = [imageWidth * 0.5, imageHeight * 0.5];

window.onload = function () {
  TweenMax.set(container, { perspective: 500 });

  // images from reddi`t`/r/wallpapers
  var urls = ["https://static.vecteezy.com/system/resources/thumbnails/042/163/600/small_2x/ai-generated-skyscrapers-on-transparent-background-ai-generated-png.png"],
    image,
    loaded = 0;
  // very quick and dirty hack to load and display the first image asap
  images[0] = image = new Image();
  image.onload = function () {
    if (++loaded === 1) {
      imagesLoaded();
      for (var i = 1; i < 1; i++) {
        images[i] = image = new Image();

        image.src = urls[i];
      }
    }
  };
  image.src = urls[0];
};

function imagesLoaded() {
  placeImage(false);
}

function placeImage(transitionIn) {
  image = images[imageIndex];
  image.draggable = false;

  if (++imageIndex === images.length) imageIndex = 0;
  container.appendChild(image);

  if (transitionIn !== false) {
    TweenMax.fromTo(image, 0.75, { y: -1000 }, { y: 0, ease: Back.easeOut });
  }
}

function imageClickHandler(event) {
  var per = Math.floor(Math.random() * 4);
  var box = image.getBoundingClientRect(),
    top = box.top,
    left = box.left;

  clickPosition[0] = event.clientX - left;
  clickPosition[1] = event.clientY - top;

  triangulate();
  shatter();
}

function triangulate() {
  var rings = [
      { r: 50, c: 12 },
      { r: 150, c: 12 },
      { r: 300, c: 12 },
      { r: 1200, c: 12 }, // very large in case of corner clicks
    ],
    x,
    y,
    centerX = clickPosition[0],
    centerY = clickPosition[1];

  vertices.push([centerX, centerY]);

  rings.forEach(function (ring) {
    var radius = ring.r,
      count = ring.c,
      variance = radius * 0.25;

    for (var i = 0; i < count; i++) {
      x =
        Math.cos((i / count) * TWO_PI) * radius +
        centerX +
        randomRange(-variance, variance);
      y =
        Math.sin((i / count) * TWO_PI) * radius +
        centerY +
        randomRange(-variance, variance);
      vertices.push([x, y]);
    }
  });

  vertices.forEach(function (v) {
    v[0] = clamp(v[0], 0, imageWidth);
    v[1] = clamp(v[1], 0, imageHeight);
  });

  indices = Delaunay.triangulate(vertices);
}

function shatter() {
  var p0, p1, p2, fragment;

  var tl0 = new TimelineMax({ onComplete: shatterCompleteHandler });

  for (var i = 0; i < indices.length; i += 3) {
    p0 = vertices[indices[i + 0]];
    p1 = vertices[indices[i + 1]];
    p2 = vertices[indices[i + 2]];

    fragment = new Fragment(p0, p1, p2);

    var dx = fragment.centroid[0] - clickPosition[0],
      dy = fragment.centroid[1] - clickPosition[1],
      d = Math.sqrt(dx * dx + dy * dy),
      rx = 30 * sign(dy),
      ry = 90 * -sign(dx),
      delay = d * 0.003 * randomRange(0.9, 1.1);
    fragment.canvas.style.zIndex = Math.floor(d).toString();

    var tl1 = new TimelineMax();

    tl1.to(fragment.canvas, 1, {
      z: -500,
      rotationX: rx,
      rotationY: ry,
      ease: Cubic.easeIn,
    });
    tl1.to(fragment.canvas, 0.4, { alpha: 0 }, 0.6);

    tl0.insert(tl1, delay);

    fragments.push(fragment);
    container.appendChild(fragment.canvas);
  }

  container.removeChild(image);
  image.removeEventListener("click", imageClickHandler);
}

function shatterCompleteHandler() {
  // add pooling?
  fragments.forEach(function (f) {
    container.removeChild(f.canvas);
  });
  fragments.length = 0;
  vertices.length = 0;
  indices.length = 0;

  placeImage();
}

//////////////
// MATH UTILS
//////////////

function randomRange(min, max) {
  return min + (max - min) * Math.random();
}

function clamp(x, min, max) {
  return x < min ? min : x > max ? max : x;
}

function sign(x) {
  return x < 0 ? -1 : 1;
}

//////////////
// FRAGMENT
//////////////

Fragment = function (v0, v1, v2) {
  this.v0 = v0;
  this.v1 = v1;
  this.v2 = v2;

  this.computeBoundingBox();
  this.computeCentroid();
  this.createCanvas();
  this.clip();
};
Fragment.prototype = {
  computeBoundingBox: function () {
    var xMin = Math.min(this.v0[0], this.v1[0], this.v2[0]),
      xMax = Math.max(this.v0[0], this.v1[0], this.v2[0]),
      yMin = Math.min(this.v0[1], this.v1[1], this.v2[1]),
      yMax = Math.max(this.v0[1], this.v1[1], this.v2[1]);

    this.box = {
      x: xMin,
      y: yMin,
      w: xMax - xMin,
      h: yMax - yMin,
    };
  },
  computeCentroid: function () {
    var x = (this.v0[0] + this.v1[0] + this.v2[0]) / 3,
      y = (this.v0[1] + this.v1[1] + this.v2[1]) / 3;

    this.centroid = [x, y];
  },
  createCanvas: function () {
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("id", "brokecanvas");
    this.canvas.width = this.box.w;
    this.canvas.height = this.box.h;
    this.canvas.style.width = this.box.w + "px";
    this.canvas.style.height = this.box.h + "px";
    this.canvas.style.left = this.box.x + "px";
    this.canvas.style.top = this.box.y + "px";
    this.ctx = this.canvas.getContext("2d");
  },
  clip: function () {
    this.ctx.translate(-this.box.x, -this.box.y);
    this.ctx.beginPath();
    this.ctx.moveTo(this.v0[0], this.v0[1]);
    this.ctx.lineTo(this.v1[0], this.v1[1]);
    this.ctx.lineTo(this.v2[0], this.v2[1]);
    this.ctx.closePath();
    this.ctx.clip();
    this.ctx.drawImage(image, 0, 0);
  },
};

const urlArray = ["https://static.vecteezy.com/system/resources/thumbnails/038/363/072/small_2x/ai-generated-side-view-of-commercial-airplane-isolated-on-transparent-background-passenger-plane-generative-ai-png.png", "https://static.vecteezy.com/system/resources/thumbnails/038/363/072/small_2x/ai-generated-side-view-of-commercial-airplane-isolated-on-transparent-background-passenger-plane-generative-ai-png.png"];
class Enemy {
  constructor() {
    this.dir = Math.floor(Math.random() * 4);
    var enemy = document.createElement("img");
    enemy.style.position = "absolute";
    enemy.style.width = "160px";
    enemy.style.height = "90px";
    enemy.src = urlArray[Math.floor(Math.random() * 2)];
    switch (this.dir) {
      case 0:
        enemy.style.left = "-160px";
        enemy.style.top = screen.height / 2 - 250 + "px";
        enemy.setAttribute("id", "left");
        break;
      case 1:
        enemy.style.left = screen.width + "px";
        enemy.style.top = screen.height / 2 - 259 + "px";
        enemy.setAttribute("id", "right");
        break;
      case 2:
        enemy.style.left = screen.width / 2 - 80 + "px";
        enemy.style.top = screen.height + "px";
        enemy.setAttribute("id", "up");
        break;
      case 3:
        enemy.style.left = screen.width / 2 - 80 + "px";
        enemy.style.top = "-90px";
        enemy.setAttribute("id", "down");
        break;
    }
    enemy.setAttribute("class", "enemy");
    enemy.addEventListener("animationend", () => {
      if (enemy.getAttribute("id") != sheild.getAttribute("class")) {
        $("img.enemy").remove();
        triangulate();
        shatter();
        clearInterval(summonEnemy);
        clearTimeout(timer);
      }
    });
    document.body.appendChild(enemy);
    console.log(enemy);
  }
}

let summonEnemy = setInterval(() => {
  var enemy = new Enemy();
  console.log(enemy.dir);
}, 500);

function startGame() {
  summonEnemy = setInterval(() => {
    var enemy = new Enemy();
    console.log(enemy.dir);
  }, 350);
  timer = setTimeout(() => {
    clearInterval(summonEnemy);
  }, 60000);
}

let timer = setTimeout(() => {
  clearInterval(summonEnemy);
}, 60000);

const sheild = document.getElementById("shield");

window.addEventListener("keydown", (e) => {
  const key = e.key;
  console.log(key);
  switch (key) {
    case "W":
    case "w":
    case "ArrowUp":
      sheild.setAttribute("class", "down");
      sheild.style.top = "15%";
      sheild.style.left = "46.5%";
      break;
    case "A":
    case "a":
    case "ArrowLeft":
      sheild.setAttribute("class", "right");
      sheild.style.top = "25%";
      sheild.style.left = "38%";
      break;
    case "S":
    case "s":
    case "ArrowDown":
      sheild.setAttribute("class", "up");
      sheild.style.top = "37%";
      sheild.style.left = "46.5%";
      break;
    case "d":
    case "D":
    case "ArrowRight":
      sheild.setAttribute("class", "left");
      sheild.style.top = "25%";
      sheild.style.left = "55%";
      break;
  }
});
