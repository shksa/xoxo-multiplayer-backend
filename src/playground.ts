class YoYo {
  a: number
  b: string
  constructor() {
    this.a = 56
    this.b = "g-eazy"
  }

  makeSomeNoise = () => {
    console.log(`YoYo ${this.a} ${this.b}`)
  }
}

const yoyo = new YoYo()

yoyo.makeSomeNoise()