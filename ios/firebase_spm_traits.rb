# frozen_string_literal: true

# Firebase Apple SDK 13 gates Cloud Firestore on the SwiftPM "Firestore" trait.
# The product still builds FirebaseFirestoreTarget, whose dummy.m fails the
# compile when that trait is off. React Native Firebase adds the
# firebase-ios-sdk package reference without a traits list. Xcodeproj does not
# model `traits`, so a later project.save would also drop the key, and Xcode
# then resolves the package with the trait disabled.
#
# Firebase 13.0.0 (the version RNFB 27 pins) has one trait, Firestore, and it
# is the default. Auth, App Check, Functions, Remote Config, Storage, Core, and
# Installations are ordinary products and are not trait-gated. Enabling
# `default` keeps any future default trait, and naming Firestore explicitly
# keeps this app's Firestore dependency on if `default` is cleared.

GIFTEEZ_FIREBASE_SPM_TRAITS = %w[Firestore default].freeze
GIFTEEZ_FIREBASE_SPM_URL = 'github.com/firebase/firebase-ios-sdk'

def gifteez_register_firebase_spm_traits_attribute!
  return unless defined?(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)

  klass = Xcodeproj::Project::Object::XCRemoteSwiftPackageReference
  return if klass.method_defined?(:traits)

  klass.send(:attribute, :traits, Array)
  %i[@full_attributes @simple_attributes @to_one_attributes @to_many_attributes].each do |ivar|
    klass.remove_instance_variable(ivar) if klass.instance_variable_defined?(ivar)
  end
end

def gifteez_firebase_spm_package?(package)
  return false unless package.respond_to?(:repositoryURL)

  package.repositoryURL.to_s.include?(GIFTEEZ_FIREBASE_SPM_URL)
end

# Turns the Firestore trait on for every firebase-ios-sdk package reference in
# one Xcode project. Returns true when a reference changed.
def gifteez_enable_firebase_spm_traits(project)
  gifteez_register_firebase_spm_traits_attribute!
  root = project&.root_object
  return false unless root.respond_to?(:package_references)

  changed = false
  root.package_references.each do |package|
    next unless gifteez_firebase_spm_package?(package)
    next unless package.respond_to?(:traits=)

    current = package.traits
    next if current.is_a?(Array) && current.map(&:to_s).sort == GIFTEEZ_FIREBASE_SPM_TRAITS.sort

    package.traits = GIFTEEZ_FIREBASE_SPM_TRAITS.dup
    changed = true
  end
  changed
end

def gifteez_enable_firebase_spm_traits_for_installer(installer)
  projects = []
  projects << installer.pods_project if installer.respond_to?(:pods_project) && installer.pods_project
  if installer.respond_to?(:aggregate_targets)
    installer.aggregate_targets.each do |aggregate|
      projects << aggregate.user_project if aggregate.respond_to?(:user_project) && aggregate.user_project
    end
  end

  projects.uniq.each do |project|
    next unless gifteez_enable_firebase_spm_traits(project)

    if defined?(Pod::UI)
      message = '[Gifteez] Enabling Firebase package traits (Firestore, default) so Cloud Firestore can build.'
      message = message.green if message.respond_to?(:green)
      Pod::UI.puts message
    end
    project.save if project.respond_to?(:dirty?) && project.dirty? && project.respond_to?(:save)
  end
end

# RNFB links FirebaseCore onto the app target from inside its own
# post_integrate wrapper, which runs after the Podfile's post_integrate block.
# This wrapper runs after that, so the trait is still there once RNFB saves.
def gifteez_install_firebase_spm_traits_hook!(installer)
  gifteez_register_firebase_spm_traits_attribute!
  installer_class = installer.class
  hook = :run_podfile_post_integrate_hooks
  return unless installer_class.method_defined?(hook) || installer_class.private_method_defined?(hook)
  return if installer_class.method_defined?(:gifteez_original_post_integrate) ||
            installer_class.private_method_defined?(:gifteez_original_post_integrate)

  installer_class.class_eval do
    alias_method :gifteez_original_post_integrate, hook

    define_method(hook) do
      result = gifteez_original_post_integrate
      gifteez_enable_firebase_spm_traits_for_installer(self)
      result
    end
  end
end

gifteez_register_firebase_spm_traits_attribute!
