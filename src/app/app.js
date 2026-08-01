import { __decorate } from "tslib";
import { Component, signal } from '@angular/core';
let App = class App {
    title = signal('drone-zones');
};
App = __decorate([
    Component({
        selector: 'app-root',
        imports: [],
        templateUrl: './app.html',
        styleUrl: './app.css',
    })
], App);
export { App };
