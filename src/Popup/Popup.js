'use strict';

import Popup from './PopupModel';
import Draggable from '../Draggable/Draggable';

const CN_POPUP = 'popup';
const CN_POPUP_VISIBLE = `${CN_POPUP}-visible`;
const CN_POPUP_HIDDEN = `${CN_POPUP}-hidden`;
const CN_POPUP_MODAL = `${CN_POPUP}-modal`;
const CN_POPUP_WINDOW = `${CN_POPUP}--window`;
const CN_POPUP_TITLE = `${CN_POPUP}--title`;
const CN_POPUP_CONTENT = `${CN_POPUP}--content`;
const CN_POPUP_BUTTONS = `${CN_POPUP}--buttons`;

const CN_BUTTON = 'button';


const S_POPUP_WINDOW = `.${CN_POPUP_WINDOW}`;

const A_POPUP = 'data-popup';
const A_POPUP_DRAG_TRIGGER = `${A_POPUP}-drag-trigger`;
const A_POPUP_CLOSE = `${A_POPUP}-close`;

const Z_INDEX_OFFSET = 30;

const DRAGGABLE_OPTIONS = {
		restrict: {
			restriction: document.body,
			elementRect: {
				top: 0,
				right: 1,
				left: 0,
				bottom: 1
			}
		},
		maxPerElement: Infinity
};

/**
 * Compute element sizes if it is hidden
 * @param {HTMLElement} element
 * @param {HTMLElement} [hiddenParent]
 */
function getSizesOfHiddenElement(element, hiddenParent) {
	let hiddenElement = hiddenParent || element;
	let width;
	let height;

	hiddenElement.style.visibility = 'hidden';
	hiddenElement.style.display = 'block';
	hiddenElement.style.position = 'absolute';

	[width, height] = getElementSizes(element);

	hiddenElement.style.visibility = '';
	hiddenElement.style.display = '';
	hiddenElement.style.position = '';

	return [width, height];
}

function getElementSizes(element) {
	let {width, height} = element.getBoundingClientRect();

	return [width, height];
}


function getPopupElements(popupElement) {
	let window = popupElement.querySelector(S_POPUP_WINDOW);
	let dragTriggers = Array.from(popupElement.querySelectorAll(`[${A_POPUP_DRAG_TRIGGER}]`));
	let closers = Array.from(popupElement.querySelectorAll(`[${A_POPUP_CLOSE}]`));

	return {
		popup: popupElement,
		window,
		dragTriggers,
		closers
	};
}

function createPopupElements(config) {
	let popup = document.createElement('section');

	popup.innerHTML = `
		<div class="${CN_POPUP_WINDOW}">
			<header ${A_POPUP_DRAG_TRIGGER} class="popup--header">
				<h6 class="${CN_POPUP_TITLE}">${config.title}</h6>
				<span ${A_POPUP_CLOSE} class="popup--close">×</span>
			</header>
			<div class="${CN_POPUP_CONTENT}">
			</div>
			<footer class="popup--footer">
				<div class="${CN_POPUP_BUTTONS}">

				</div>
			</footer>
		</div>`;

	let popupContent = popup.querySelector(`.${CN_POPUP_CONTENT}`);

	popupContent.innerHTML = config.content;

	if (config.buttons) {
		let popupButtons = popup.querySelector(`.${CN_POPUP_BUTTONS}`);

		config.buttons.map(createBtnFromConfig)
			.forEach(btn => popupButtons.appendChild(btn));
	}
	document.body.appendChild(popup);
	return getPopupElements(popup);
}

function createBtnFromConfig(cfg) {
	let btn = document.createElement('button');
	btn.classList.add(CN_BUTTON);

	btn.innerHTML = `<span>${cfg.text}</span>`;

	cfg.modifiers
		.map(modifier => `${CN_BUTTON}-${modifier}`)
		.forEach(modifier => btn.classList.add(modifier));

	if (cfg.isCloser) {
		btn.setAttribute(A_POPUP_CLOSE, true);
	}

	return btn;
}

class PopupView {

	/**
	 * @param {Object} [options]
	 * @param {HTMLElement} [element]
	 */
	constructor(element, options) {

		this.elements = (element instanceof HTMLElement) ? getPopupElements(element) : createPopupElements(element);

		this._model = new Popup();
		this._initModelListeners();
		this._model.set(options);

		this._initDraggables();
		this._initUIListeners();
	}


	/**
	 * Shows popup
	 * @param {Number} [x]
	 * @param {Number} [y]
	 */
	show(x, y) {
		if (typeof x !== 'undefined' && typeof y !== 'undefined') {
			this._model.set({
				posX: x,
				posY: y
			});
		}

		this._model.show();
	}

	/**
	 * Shows popup at center of window or element if it provided
	 * @param {HTMLElement} [origin]
	 */
	showCentered(origin) {
		let parentOffsetX = 0;
		let parentOffsetY = 0;
		let parentWidth = window.innerWidth;
		let parentHeight = window.innerHeight;
		let [popupWindowWidth, popupWindowHeight] = this.getWindowSizes();

		if (origin) {
			let bounds = origin.getBoundingClientRect();
			parentWidth = bounds.width;
			parentHeight = bounds.height;
			parentOffsetX = bounds.left;
			parentOffsetY = bounds.top;
		}

		let x = (parentWidth / 2) - (popupWindowWidth / 2) + parentOffsetX;
		let y = (parentHeight / 2) - (popupWindowHeight / 2) + parentOffsetY;

		this.show(x, y);
	}

	showModal() {
		let {window} = this.elements;

		window.style.top = '';
		window.style.left = '';

		this._setModalState();
		this.showCentered();
	}

	/**
	 * Computes and return popup window sizes
	 * @returns [width:number, height:number]
	 */
	getWindowSizes() {
		let {popup, window} = this.elements;
		let isVisible = this._model.get('isVisible');

		return isVisible ? getElementSizes(window) : getSizesOfHiddenElement(window, popup);
	}

	/**
	 * hides popup
	 */
	hide() {
		this._resetModalState();
		this._model.hide();
	}

	disableDragging() {
		this._model.set({
			isDraggable: false
		});
	}

	enableDragging() {
		this._model.set({
			isDraggable: true
		});
	}

	_setModalState() {
		this._model.set('isModal', true);
		this._disableDragging();
	}

	_resetModalState() {
		this._model.set('isModal', false);
		this._enableDragging();
	}

	_initDraggables() {
		let elements = this.elements;
		let draggableOptions = Object.assign({
			enabled: this._model.get('isDraggable')
		}, DRAGGABLE_OPTIONS, {origin: elements.popup});

		this._draggables = elements.dragTriggers.map((trigger) => {
			let draggable = new Draggable(trigger, draggableOptions);
			draggable.onMove((e) => {
				this._model.move(e.dx, e.dy);
			});

			return draggable;
		});
	}

	_initUIListeners() {
		let {popup} = this.elements;

		popup.addEventListener('mousedown', () => {
			this._model.toFront();
		});

		popup.addEventListener('click', (e) => {
			//TODO: Use get ascendant from DXJS lib
			if (e.target.hasAttribute(A_POPUP_CLOSE)) {
				this.hide();
			}
		});
	}

	_enableDragging() {
		let isDraggable = this._model.get('isDraggable');

		if (isDraggable) {
			this._draggables.forEach((draggable) => {
				draggable.enable();
			});
		}
	}

	_disableDragging() {
		this._draggables.forEach((draggable) => {
			draggable.disable();
		});
	}

	_initModelListeners() {
		let {window} = this.elements;

		this._model.on(`${Popup.E_CHANGED}:posX`, (x) => {
			window.style.left = x + 'px';
		});

		this._model.on(`${Popup.E_CHANGED}:posY`, (y) => {
			window.style.top = y + 'px';
		});

		this._model.on(`${Popup.E_CHANGED}:isVisible`, (isVisible) => {
			let {popup} = this.elements;

			popup.classList.add(isVisible ? CN_POPUP_VISIBLE : CN_POPUP_HIDDEN);
			popup.classList.remove(!isVisible ? CN_POPUP_VISIBLE : CN_POPUP_HIDDEN);
		});

		this._model.on(`${Popup.E_CHANGED}:isDraggable`, (isDraggable) => {
			return (isDraggable) ? this._enableDragging() : this._disableDragging();
		});

		this._model.on(`${Popup.E_CHANGED}:orderPosition`, (position) => {
			let {popup} = this.elements;

			popup.style.zIndex = Z_INDEX_OFFSET + position;
		});

		this._model.on(`${Popup.E_CHANGED}:isModal`, (isModal) => {
			let {popup} = this.elements;

			return isModal ? popup.classList.add(CN_POPUP_MODAL) : popup.classList.remove(CN_POPUP_MODAL);
		});
	}
}

export default window.PopupView = PopupView;