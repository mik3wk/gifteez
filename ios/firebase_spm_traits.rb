# frozen_string_literal: true

require 'json'
require 'pathname'

# Firebase Apple SDK 13 gates Cloud Firestore on the SwiftPM "Firestore" trait.
# FirebaseFirestoreTarget still compiles, and its dummy.m errors when the trait
# is off. Auth, App Check, Functions, Remote Config, Storage, Core, and
# Installations are ordinary products and are not trait-gated.
#
# Xcode 26.4+ stores the selection as `traits = ( ... );` on
# XCRemoteSwiftPackageReference. Xcode 26.2 does not read that key (Package
# Dependencies has no Traits column) and SwiftPM 6.2.3 then drops an
# unspecified trait set, so the default Firestore trait stays off. The key is
# still written for 26.4+. What 26.2 honors is a Package.swift dependency that
# names the trait: ios/FirebaseFirestoreTrait. Trait sets union, so that edge
# enables Firestore for the shared firebase-ios-sdk package. pod install links
# that local package from the RNFBFirestore pod, the target that builds
# FirebaseFirestore.

GIFTEEZ_FIREBASE_SPM_TRAITS = %w[Firestore default].freeze
GIFTEEZ_FIREBASE_SPM_URL = 'github.com/firebase/firebase-ios-sdk'
GIFTEEZ_FIRESTORE_TRAIT_PRODUCT = 'FirebaseFirestoreTrait'

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

def gifteez_firestore_trait_package_dir
  File.expand_path('FirebaseFirestoreTrait', __dir__)
end

def gifteez_firebase_ios_sdk_version
  if defined?($FirebaseSDKVersion) && !$FirebaseSDKVersion.to_s.empty?
    return $FirebaseSDKVersion.to_s
  end

  env = ENV.fetch('FIREBASE_SDK_VERSION', nil)
  return env unless env.nil? || env.empty?

  package_json = File.expand_path('../node_modules/@react-native-firebase/app/package.json', __dir__)
  return nil unless File.file?(package_json)

  JSON.parse(File.read(package_json)).dig('sdkVersions', 'ios', 'firebase')
end

# Keeps the local package on the same exact firebase-ios-sdk version RNFB pins.
def gifteez_sync_firestore_trait_package_version!
  version = gifteez_firebase_ios_sdk_version
  return false if version.nil? || version.empty?

  path = File.join(gifteez_firestore_trait_package_dir, 'Package.swift')
  return false unless File.file?(path)

  contents = File.read(path)
  updated = contents.sub(/exact: "[^"]+"/, %(exact: "#{version}"))
  return false if updated == contents

  File.write(path, updated)
  true
end

def gifteez_project_directory(project)
  path = project.path.to_s
  path = File.dirname(path) if path.end_with?('.pbxproj')
  path = File.dirname(path) if path.end_with?('.xcodeproj')
  path
end

def gifteez_firestore_trait_relative_path(project)
  package_dir = gifteez_firestore_trait_package_dir
  project_dir = File.expand_path(gifteez_project_directory(project))
  Pathname.new(package_dir).relative_path_from(Pathname.new(project_dir)).to_s
end

def gifteez_new_object(project, klass)
  uuid = project.generate_uuid
  uuid = project.generate_uuid while project.objects_by_uuid.key?(uuid)
  object = klass.new(project, uuid)
  object.initialize_defaults
  object
end

def gifteez_target_needs_firestore_trait_package?(target)
  return false unless target.respond_to?(:package_product_dependencies)

  target.name == 'RNFBFirestore' || target.package_product_dependencies.any? do |dep|
    dep.respond_to?(:product_name) && dep.product_name == 'FirebaseFirestore'
  end
end

# Links ios/FirebaseFirestoreTrait into a target that builds FirebaseFirestore.
# Returns true when the project changed.
def gifteez_add_firestore_trait_package!(project, target, relative_path)
  return false unless defined?(Xcodeproj::Project::Object::XCLocalSwiftPackageReference)
  return false unless target.respond_to?(:package_product_dependencies)

  root = project.root_object
  return false unless root.respond_to?(:package_references)

  changed = false
  pkg_class = Xcodeproj::Project::Object::XCLocalSwiftPackageReference
  pkg = root.package_references.find do |candidate|
    candidate.instance_of?(pkg_class) && candidate.relative_path == relative_path
  end
  unless pkg
    pkg = gifteez_new_object(project, pkg_class)
    pkg.relative_path = relative_path
    root.package_references << pkg
    changed = true
  end

  ref_class = Xcodeproj::Project::Object::XCSwiftPackageProductDependency
  ref = target.package_product_dependencies.find do |candidate|
    candidate.instance_of?(ref_class) && candidate.product_name == GIFTEEZ_FIRESTORE_TRAIT_PRODUCT
  end
  unless ref
    ref = gifteez_new_object(project, ref_class)
    ref.product_name = GIFTEEZ_FIRESTORE_TRAIT_PRODUCT
    ref.package = pkg
    target.package_product_dependencies << ref
    changed = true
  end
  # React Native's SPM integration drops every package reference on the next
  # pod install and adds the remote ones back. Reattach the product if that
  # left it pointing at the removed local package.
  if ref.package != pkg
    ref.package = pkg
    changed = true
  end

  phase = target.respond_to?(:frameworks_build_phase) ? target.frameworks_build_phase : nil
  if phase && phase.files.none? { |build_file| build_file.product_ref == ref }
    build_file = gifteez_new_object(project, Xcodeproj::Project::Object::PBXBuildFile)
    build_file.product_ref = ref
    phase.files << build_file
    changed = true
  end
  changed
end

def gifteez_link_firestore_trait_package!(project)
  return false unless project.respond_to?(:native_targets) && project.respond_to?(:path) && project.path

  relative = gifteez_firestore_trait_relative_path(project)
  changed = false
  project.native_targets.each do |target|
    next unless gifteez_target_needs_firestore_trait_package?(target)

    changed = true if gifteez_add_firestore_trait_package!(project, target, relative)
  end
  changed
end

def gifteez_puts(message)
  return unless defined?(Pod::UI)

  message = message.green if message.respond_to?(:green)
  Pod::UI.puts message
end

def gifteez_enable_firebase_spm_traits_for_installer(installer)
  gifteez_sync_firestore_trait_package_version!

  projects = []
  projects << installer.pods_project if installer.respond_to?(:pods_project) && installer.pods_project
  if installer.respond_to?(:aggregate_targets)
    installer.aggregate_targets.each do |aggregate|
      projects << aggregate.user_project if aggregate.respond_to?(:user_project) && aggregate.user_project
    end
  end

  projects.uniq.each do |project|
    traits_changed = gifteez_enable_firebase_spm_traits(project)
    package_changed = gifteez_link_firestore_trait_package!(project)
    next unless traits_changed || package_changed

    if traits_changed
      gifteez_puts '[Gifteez] Enabling Firebase package traits (Firestore, default) so Cloud Firestore can build.'
    end
    if package_changed
      gifteez_puts '[Gifteez] Linking FirebaseFirestoreTrait so the Firestore package trait is enabled.'
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
