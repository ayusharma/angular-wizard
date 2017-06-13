/**
 * Datashop Notification - Notificaion Service for Datashop.
 * @author Ayush Sharma
 * @version v0.0.1
 * @link 
 * @license MIT
 */
angular.module('wizard', [])

.service('wizardService', ["$q", "$rootScope", "$templateRequest", "$compile", "$controller", function ($q, $rootScope, $templateRequest, $compile,
  $controller) {
  /**
   * getTemplate - Get template
   *
   * @param  {string} template
   * @param  {string} templateUrl
   * @return {promise}
   */
  var getTemplate = function (template, templateUrl) {
    var deferred = $q.defer();
    if (template) {
      deferred.resolve(template);
    } else if (templateUrl) {
      $templateRequest(templateUrl)
        .then(function (tpl) {
          deferred.resolve(tpl);
        }, function (error) {
          deferred.reject(error);
        });
    } else {
      deferred.reject('No template or templateUrl has been specified.');
    }
    return deferred.promise;
  };

  /**
   * compileTemplate - compile template with controller and scope
   *
   * @param  {object} options contains controller, scope and template
   * @return {promise} templateElement  compiled template event
   */
  this.compileTemplate = function (obj) {
    var deferred = $q.defer();
    getTemplate(obj.template, obj.templateUrl).then(function (template) {
      var scope = (obj.scope || $rootScope).$new();
      var templateElement = $compile(template)(scope);
      // Inject controller
      if (obj.controller) {
        $controller(obj.controller, {
          $scope: scope
        });
      }
      deferred.resolve({
        template: templateElement,
        scope: scope
      });
    }).catch(function (error) {
      deferred.reject(error);
    });

    return deferred.promise;
  };

  /**
   * Wizard form data
   */
  this.data = {};

  this.setData = function (step, payload) {
    this.data[step] = payload;
  };

  this.getData = function () {
    return this.data;
  };

  this.removeData = function (step) {
    delete this.data[step];
  };

  this.currentStepData = function () {
    return this.data[this.currentStep];
  };


  /**
   * Wizard form data in steps.
   */
  this.currentStep = 0; // intializes it with first step.

  /**
  * updateStep - update the current step of the wizard
  *
  * @param  {number} currentStep currentStep
  * @param  {string} action      next/prev
  */
  this.updateStep = function (index) {
    this.currentStep = index;
  };

  this.stepIncrement = function () {
    this.currentStep += 1;
  };

  this.stepDecrement = function () {
    this.currentStep -= 1;
  };


  /**
   * Models
   */
  this.validation = {};

  this.setValidation = function (name, validation) {
    this.validation[name] = validation;
  };

  this.deleteValidation = function () {
    this.validation = {};
  };

  this.checkModel = function () {
    var deferred = $q.defer();
    var bool = Object.values(this.validation).every(function (o) {
      return o === true;
    });
    if (bool) {
      deferred.resolve(bool);
    } else {
      deferred.reject();
    }
    return deferred.promise;
  };
}])

.directive('formWizard', ["wizardService", function (wizardService) {
  return {
    restrict: 'E',
    templateUrl: 'wizard-directive.html',
    scope: {
      steps: '=',
      formName: '@'
    },
    transclude: {
      steps: 'steps',
      controls: 'controlPanel'
    },
    controller: ['$element', function ($element) {
      var templateScope = null;
      /**
       * loadTemplate - load the compile template in view
       *
       * @param  {object} obj contains controller, scope information
       * @param  {number} idx index of the template to load from steps.
       */
      this.loadTemplate = function (obj, idx) {
        wizardService.compileTemplate(obj).then(function (tpl) {
          var elem = angular.element($element[0].querySelector('#wizard-views'));
          var currentStepData = wizardService.currentStepData();
          elem.empty();
          elem.append(tpl.template);
          if (currentStepData) {
            tpl.scope.model = currentStepData.model;
          }
          templateScope = tpl.scope;
          wizardService.updateStep(idx);
        });
      };

      this.saveData = function () {
        var step = wizardService.currentStep;
        if (templateScope) {
          wizardService.setData(step, {
            model: templateScope.model
          });
        }
      };

      /**
       * init - initialize when components load at fist time.
       *        load first index of steps.
       */
      this.init = function () {
        var currentStep = wizardService.currentStep;
        var obj = this.steps[currentStep];
        this.loadTemplate(obj, currentStep);
      };

      return this;
    }],
    controllerAs: 'parent',
    bindToController: true
  };
}])

.directive('steps', ["wizardService", function (wizardService) {
  return {
    restrict: 'E',
    require: '^formWizard',
    templateUrl: 'steps.html',
    link: function (scope, element, attrs, ctrl) {
      /**
       * loadTemplate- wrapper for loadTemplate in parent controller
       *
       * @param  {object} obj description
       * @param  {number} idx description
       */
      scope.loadTemplate = function (obj, idx) {
        var currentStep = wizardService.currentStep;
        // check for the current index so not compile template again.
        if (idx !== currentStep) {
          ctrl.saveData();
          ctrl.loadTemplate(obj, idx);
        }
      };
    }
  };
}])

.directive('controlPanel', ["wizardService", function (wizardService) {
  return {
    restrict: 'E',
    require: '^formWizard',
    templateUrl: 'control-panel.html',
    scope: {
      onCancel: '&onCancel',
      onSubmit: '&onSubmit'
    },
    link: function (scope, elements, attrs, ctrl) {
      var stepsLength = ctrl.steps.length;
      var loadTemplate = function (index) {
        ctrl.loadTemplate(ctrl.steps[index], index);
      };

      scope.nextStep = function () {
        return wizardService.currentStep === stepsLength - 1;
      };

      scope.prevStep = function () {
        return wizardService.currentStep === 0;
      };

      scope.control = function (action) {
        var currentStep = wizardService.currentStep;

        if (action === 'prev') {
          if (currentStep > 0) {
            wizardService.stepDecrement();
            loadTemplate(wizardService.currentStep);
          }
        }

        if (action === 'next') {
          if (currentStep < stepsLength - 1) {
            wizardService.checkModel().then(function () {
              // Saves data
              ctrl.saveData();
              wizardService.stepIncrement();
              loadTemplate(wizardService.currentStep);
              wizardService.deleteValidation();
            }).catch(function () {
              console.log('Please validate model');
            });
          }
        }
      };
    }
  };
}])
.directive('formStepValidity', ["wizardService", function (wizardService) {
  return {
    restrict: 'A',
    // require: 'ngModel' gives the controller
    // for the ngModel directive,
    require: 'ngModel',
    scope: {
      validation: '='
    },
    link: function (scope, element, attrs, ctrl) {
        // The callback to call when a change of validity
        // is detected
      console.log(scope.validation);
      ctrl.$parsers.unshift(function (viewValue) {
        // console.log(scope.validation[ctrl.$name](viewValue));
        // console.log(ctrl);
        if (scope.validation) {
          wizardService
            .setValidation(ctrl.$name, scope.validation.call(null, viewValue));
          // console.log(viewValue);
        }
        console.log(wizardService);
        // if (scope.validation[ctrl.$name](viewValue)) {
        //   ctrl.$setValidity('pwd', true);
        // }
        // console.log(viewValue);
      });
    }
  };
}]);

angular.module("wizard").run(["$templateCache", function($templateCache) {$templateCache.put("control-panel.html","<div class=\"row\"><div class=\"columns large-6 text-left\"><button class=\"button default\" ng-if=\"onCancel\" ng-click=\"onCancel()\">Cancel</button></div><div class=\"columns large-6 text-right\"><button class=\"button default\" ng-disabled=\"prevStep()\" ng-click=\"control(\'prev\')\">Previous</button> <button class=\"button primary\" ng-disabled=\"nextStep()\" ng-click=\"control(\'next\')\">Next</button> <button class=\"button primary\" ng-if=\"onSubmit\" ng-click=\"onSubmit()\">Submit</button></div></div>");
$templateCache.put("steps.html","<div id=\"status-buttons\" class=\"text-center\"><div class=\"equidistant has-cursor\" ng-repeat=\"step in steps\" ng-click=\"loadTemplate(step, $index)\">{{step.name}}</div></div>");
$templateCache.put("wizard-directive.html","<div class=\"wizard-container\" ng-init=\"parent.init()\"><div class=\"row\"><div class=\"columns large-8 large-centered card\"><div class=\"wizard-header\"><div class=\"text-center\"><b>USER REGISTRATION</b></div><div class=\"steps\" ng-transclude=\"steps\"></div></div><div class=\"wizard-body\"><div id=\"wizard-views\"></div></div><div class=\"wizard-footer\"><div ng-transclude=\"controls\"></div></div></div></div></div>");}]);