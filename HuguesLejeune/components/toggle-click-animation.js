AFRAME.registerComponent("toggle-click-animation", {
    multiple: true,

    schema: {
        name: { type: "string", default: "" },
        property: { type: "string", default: "" },
        from: { type: "string", default: "" },
        to: { type: "string", default: "" },
        dur: { type: "number", default: 500 },
        easing: { type: "string", default: "easeInOutCirc" },
    },

    init() {
        this.toggled = false;

        this.el.addEventListener("click", () => {
            const to = this.toggled ? this.data.from : this.data.to;

            this.el.setAttribute(
                `animation__${this.data.name}`,
                `property: ${this.data.property}; to: ${to}; dur: ${this.data.dur}; easing: ${this.data.easing}`,
            );
            this.toggled = !this.toggled;
        });
    },
});

AFRAME.registerComponent("toggle-click-target-animation", {
    multiple: true,

    schema: {
        name: { type: "string", default: "" },
        target: { type: "selector" },
        property: { type: "string", default: "" },
        from: { type: "string", default: "" },
        to: { type: "string", default: "" },
        dur: { type: "number", default: 500 },
        easing: { type: "string", default: "easeInOutCirc" },
    },

    init() {
        this.toggled = false;

        this.el.addEventListener("click", () => {
            const to = this.toggled ? this.data.from : this.data.to;

            this.data.target.setAttribute(
                `animation__${this.data.name}`,
                `property: ${this.data.property}; to: ${to}; dur: ${this.data.dur}; easing: ${this.data.easing}`,
            );
            this.toggled = !this.toggled;
        });
    },
});
