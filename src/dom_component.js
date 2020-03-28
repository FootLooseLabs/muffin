import { randomString } from "./utils.js";
import { DOMComponentRegistry } from "./dom_component_registry.js";
import { PostOffice } from "./post_office.js";
import { DataSource } from "./data_source.js";
import { stringToHTMLFrag } from "./utils.js";

class DOMComponent extends HTMLElement {

	static defaultLifecycleBrokers (){
		return [
					{
						label: "dataChange", 
						callback: () => {
							this.render
						}
					}
				]
	}

	static get observedAttributes() { return ['data-update']; }

	constructor(opt){
		super();
		console.log("arguments - ", arguments);
		console.log("this - ", this);
		if(this._isDebuggale()){
			TRASH_SCOPE._debugCmp = this;
		}
		var opt = opt || {};
		this.data = this.constructor.schema || {};
		this.domElName = this.constructor.domElName || opt.domElName;
		this.uid = randomString(8);
		this.data_src = null;
		this.opt = opt;
	}


	connectedCallback() {
		var opt = this.opt;
		this.__init__(opt);
		if(this.onConnect) {
			this.onConnect.call(this);
		}
	}

	__init__(opt) {
		console.log("consoling ---> ", opt);	
		var _this = this;
		this._initComponentDataSrc(opt);
		this.shadow = this.attachShadow({mode: opt.domMode || "open"});
		this.markupFunc = this.constructor.markupFunc || opt.markupFunc;
		this.processData = this.constructor.processData || opt.processData;
		if(document.readyState == "complete"){
			DOMComponentRegistry.add(this);
		}else{
			document.addEventListener("DOMContentLoaded", ()=>{DOMComponentRegistry.add(_this);});
		}
		if(!this.markupFunc){
			console.log("----------no markupFunc found---------------");
			return;
		}
		this.render();
		this._init_lifecycle(opt);
	}

	_isDebuggale() {
		return this.hasAttribute("debug");
	}

	_getCmpData(){
		return this.querySelector("component-data");
	}

	_initComponentDataSrc(opt){
		var _cmp_data = this._getCmpData();
		if(_cmp_data){
			var label = _cmp_data.getAttribute("label");
			var socket = _cmp_data.getAttribute("socket");
			if(label && socket){
				this.__initDataSrcBroker(label);
				this.data_src = new DataSource(label, socket, this);
				 // Object.defineProperty(this, 'data', {
				 //        get: ()=>{return this.data_src._get()},
				 //        // set: (val) => {this.data_src._updateData(val)}
				 //        set: (val) => {this.data = val}
				 //    });	
			}
		}
	}

	_getDomNode(){
		return document.querySelector("[data-component='" + this.uid + "']");
	}

	__initDataSrcBroker(label,cb,scope) {
		var _this = this;
		this.broker = PostOffice.registerBroker(_this, label, (ev)=> {
			console.log("imp:",_this.label,"- ","component data update signal received");
			try{
				var _newData = _this.data_src._get();
				_newData.then((_val)=>{
					_this.processCmpData(_val);
					_this.render();
				})
			}catch(e){
				console.log("imp:","(ERROR) - ", e);
			}
		})
	}

	_init_default_brokers(opt) {
		// DOMComponent.defaultLifecycleBrokers.forEach((_le)=>{
		// 	PostOffice.registerBroker(_le.label, update)
		// 	document.addEventListener(_le.label, _le.callback);
		// });
	}

	_init_lifecycle(opt) {
		this._init_default_brokers(opt)
	}

	processCmpData(newData) {
		console.log("imp:","THEN - ", this.data_src.label, " === ", newData);
		try{
			if(this.processData){   //processData can be defined when creating components (see inventory_block.js - MedicineThumbnailList)
				var newData = this.processData.call(this, newData);
			}
			this.data = newData;
			return true;
		}catch(e){
			console.log("imp:","could not update CMP data");
			return false;
		}
	}

	__processRenderedFragEventListeners () {
		var _this = this;
		this._renderedFrag.querySelectorAll("[on-change]").forEach((_el)=>{
			_el.onchange = function() {
				// _el.attributes["on-change"].value.call(_this);
				_this[_el.attributes["on-change"].value].call(_this, _el);
			}
		});
		this._renderedFrag.querySelectorAll("[on-input]").forEach((_el)=>{
			_el.onchange = function() {
				_this[_el.attributes["on-input"].value].call(_this, _el);
			}
		});
		this._renderedFrag.querySelectorAll("[on-click]").forEach((_el)=>{
			_el.onchange = function() {
				_this[_el.attributes["on-click"].value].call(_this, _el);
			}
		});
	}

	render() {
		console.log("----------rendering component start---------------");
		var _this = this;
		TRASH_SCOPE.____data = this.data;
		var _rendered = this.markupFunc.call(this, this.data, this.uid);
		// this.shadow.innerHTML = _rendered;

		// console.log("imp:","rendered markupFunc");
		this._renderedFrag = stringToHTMLFrag(_rendered);
		// console.log("imp:","rendered fragment");
		this._renderedFrag.firstElementChild.dataset.component = this.uid;

		this.__processRenderedFragEventListeners();
		// console.log("imp:","renderered fragment uid");
		var cmp_dom_node = this._getDomNode();
		try{
			if(cmp_dom_node){
				// cmp_dom_node.outerHTML = _rendered;
				cmp_dom_node.replaceWith(this._renderedFrag); //case when a rendered custom element re-rendering (after some data update)
			}else{
				// this.outerHTML = _rendered; //case when custom element in the html is rendered for the 1st time
				this.replaceWith(this._renderedFrag);
			}
			// console.log("imp:","cmpdomnode = ", cmp_dom_node);
			
		}catch(e){
			console.log("imp:","(ERROR) - component rendering failed with the following error - \n", e);
		}
		TRASH_SCOPE.debugRenderedCmp = this;
		console.log("----------rendering component end-----------------");
		return this
	}

	attributeChangedCallback () {
		this.render();
	}
	
}

DOMComponent.prototype._binding = function(b) {
    var _this = this;
    this.element = b.element;    
    this.value = b.object[b.property];
    this.attribute = b.attribute;
    this.valueGetter = function(){
        return _this.value;
    }
    this.valueSetter = function(val){
        _this.value = val;
        _this.element[_this.attribute] = val;
    }

    Object.defineProperty(b.object, b.property, {
        get: this.valueGetter,
        set: this.valueSetter
    }); 
    b.object[b.property] = this.value;

    this.element[this.attribute] = this.value;
}


export {
	DOMComponent,
	PostOffice,
	DataSource,
	DOMComponentRegistry
}